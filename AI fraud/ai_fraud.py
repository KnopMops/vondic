import joblib

class FraudDetector:
    """
    Класс для анализа текста на мошенничество.
    Использует предобученную модель и векторизатор.
    """
    def __init__(self, model_path='fraud_model.pkl', vectorizer_path='vectorizer.pkl'):
        # Загружаем файлы один раз при инициализации класса
        try:
            self.model = joblib.load(model_path)
            self.vectorizer = joblib.load(vectorizer_path)
        except Exception as e:
            raise IOError(f"Ошибка при загрузке файлов модели: {e}")

    def analyze(self, text: str):
        """
        Принимает строку текста и возвращает результат анализа.
        """
        if not text.strip():
            return {"error": "Пустой текст"}

        # Векторизация
        text_vectorized = self.vectorizer.transform([text])
        
        # Предсказание вероятностей
        # prob[0][0] - вероятность "чистого" сообщения
        # prob[0][1] - вероятность мошенничества
        prob = self.model.predict_proba(text_vectorized)
        
        fraud_probability = prob[0][1]
        is_fraud = bool(self.model.predict(text_vectorized)[0])

        return {
            "is_fraud": is_fraud,
            "probability": round(fraud_probability * 100, 2),
            "label": "Мошенник" if is_fraud else "Не мошенник"
        }

