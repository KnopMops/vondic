import os
import re
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

try:
    import pandas as pd
except Exception:
    pd = None
try:
    import numpy as np
except Exception:
    np = None
try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None
try:
    import faiss
except Exception:
    faiss = None
try:
    from transformers import pipeline
except Exception:
    pipeline = None

class RAGEngine:
    def __init__(self):
        self.questions: List[str] = []
        self.norm_questions: List[str] = []
        self.contents: List[str] = []
        self.categories: List[str] = []
        self.embedder = None
        self.embeddings = None
        self.index = None
        self.generator = None
        self._load_data()
        self._build_models()

    def _load_data(self):
        data_dir = os.getenv("RAG_DATA_DIR", os.path.dirname(__file__))
        preferred = os.getenv("RAG_PREFERRED_FILE", "lx.xlsx")
        xlsx_path = os.path.join(data_dir, preferred)
        loaded = False
        if pd is not None and os.path.isfile(xlsx_path):
            try:
                df = pd.read_excel(xlsx_path)
                cols_ok = {"question", "content",
                           "category"}.issubset(set(df.columns))
                if cols_ok:
                    self.questions = [str(x or "")
                                      for x in df["question"].fillna("")]
                    self.contents = [str(x or "")
                                     for x in df["content"].fillna("")]
                    self.categories = [
                        str(x or "прочее") for x in df["category"].fillna("прочее")
                    ]
                    self.norm_questions = [
                        self._preprocess(q) for q in self.questions]
                    loaded = True
            except Exception:
                loaded = False
        if not loaded:
            self.questions = [
                "Как войти через Yandex?",
                "Как работает 2FA и где взять код?",
                "Как привязать Telegram?",
            ]
            self.contents = [
                "Для входа через Yandex нажмите кнопку «Войти через Yandex». После авторизации вас перенаправит в ленту.",
                "Если включена 2FA, отправьте код на почту и введите шестизначный код на странице входа.",
                "Откройте «Настройки» и выберите привязку Telegram. Получите шестизначный ключ и введите его там, где будет предложено — после этого аккаунты будут связаны.",
            ]
            self.categories = ["auth", "security", "integrations"]
            self.norm_questions = [self._preprocess(q) for q in self.questions]

    def _preprocess(self, text: str) -> str:
        t = str(text).lower()

        try:
            syn = {
                "телеграм": "telegram",
                "яндекс": "yandex",
                "гугл": "google",
                "инстаграм": "instagram",
                "фейсбук": "facebook",
                "вайбер": "viber",
                "ватсап": "whatsapp",
                "вк": "vk",
                "вконтакте": "vk",
                "tg": "telegram",
                "связать": "привязать",
                "связка": "привязка",
            }
            for k, v in syn.items():
                t = t.replace(k, v)
        except Exception:
            pass
        t = re.sub(r"[^a-zа-я0-9\s]+", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        return t

    def _build_models(self):
        if SentenceTransformer is not None and np is not None:
            try:
                self.embedder = SentenceTransformer(
                    "paraphrase-multilingual-MiniLM-L12-v2"
                )
                proc_q = [self._preprocess(q) for q in self.questions]
                self.embeddings = self.embedder.encode(
                    proc_q, convert_to_numpy=True)
                if faiss is not None:
                    d = int(self.embeddings.shape[1])
                    self.index = faiss.IndexFlatL2(d)
                    self.index.add(self.embeddings)
            except Exception:
                self.embedder = None
                self.embeddings = None
                self.index = None
        if pipeline is not None:
            try:
                self.generator = pipeline(
                    "text-generation",
                    model="ai-forever/rugpt3small_based_on_gpt2")
            except Exception:
                self.generator = None

    def _match_from_questions(self, query: str) -> int:
        q = self._preprocess(query)
        if not q:
            return -1
        for i, nq in enumerate(self.norm_questions):
            if q == nq or q in nq or nq in q:
                return i
        try:
            import difflib as _dif

            close = _dif.get_close_matches(
                q, self.norm_questions, n=1, cutoff=0.85)
            if close:
                idx = self.norm_questions.index(close[0])
                return idx
            best_ratio = 0.0
            best_idx = -1
            for i, nq in enumerate(self.norm_questions):
                ratio = _dif.SequenceMatcher(None, q, nq).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_idx = i
            if best_idx >= 0 and best_ratio >= 0.75:
                return best_idx
        except Exception:
            pass
        q_tokens = set(q.split())
        best_score = 0.0
        best_idx = -1
        for i, nq in enumerate(self.norm_questions):
            nq_tokens = set(nq.split())
            if not nq_tokens:
                continue
            score = len(q_tokens & nq_tokens) / \
                max(1, len(q_tokens | nq_tokens))
            if score > best_score:
                best_score = score
                best_idx = i
        if best_idx >= 0 and best_score >= 0.5:
            return best_idx
        return -1

    def answer(self, query: str) -> str:
        if not query.strip():
            return ""
        idx = self._match_from_questions(query)
        if idx >= 0:
            content = self.contents[idx]
            if self.generator is not None and content:
                try:
                    out = self.generator(
                        content, max_new_tokens=120, num_return_sequences=1
                    )
                    text = out[0].get("generated_text") or ""
                    return text.strip() or content
                except Exception:
                    return content
            return content
        return ""

app = FastAPI()
engine = RAGEngine()

class AskPayload(BaseModel):
    question: str

@app.post("/ask")
def ask(payload: AskPayload):
    q = (payload.question or "").strip()
    ans = engine.answer(q)
    return {"answer": ans}

@app.get("/health")
def health():
    return {
        "loaded": bool(engine.questions and engine.contents),
        "embedder": engine.embedder is not None,
        "index": engine.index is not None,
        "generator": engine.generator is not None,
        "items": len(engine.contents),
    }
