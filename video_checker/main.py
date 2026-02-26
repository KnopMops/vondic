import json
import os
import sys
import warnings

import whisper
from NudeNetv2 import NudeClassifier
from safetext import SafeText

os.environ.setdefault("ORT_LOGGING_LEVEL", "4")


def load_models():
    warnings.filterwarnings(
        "ignore", message="You are using the default legacy behaviour"
    )
    whisper_model = whisper.load_model("base")
    profanity_filter = SafeText(language="ru")
    nude_classifier = NudeClassifier()
    return whisper_model, profanity_filter, nude_classifier


def analyze_video(video_path: str, unsafe_threshold: float = 0.7):
    whisper_model, profanity_filter, nude_classifier = load_models()
    result = whisper_model.transcribe(video_path, verbose=False)
    audio_issues = []
    for segment in result.get("segments", []):
        start_time = segment.get("start", 0)
        text_segment = (segment.get("text") or "").strip()
        if not text_segment:
            continue
        found_bad_words = profanity_filter.check_profanity(text=text_segment)
        if found_bad_words:
            bad_words_list = [
                item.get("word")
                for item in found_bad_words
                if isinstance(item, dict) and item.get("word")
            ]
            audio_issues.append(
                {
                    "time": start_time,
                    "type": "MAT",
                    "details": f"Найдены слова: {
                        ', '.join(
                            sorted(
                                set(bad_words_list)))}",
                    "text": text_segment,
                })
    video_predictions = nude_classifier.classify_video(video_path)
    video_issues = []
    preds = (
        video_predictions.get("preds") if isinstance(
            video_predictions, dict) else None
    )
    if preds:
        metadata = (
            video_predictions.get("metadata")
            if isinstance(video_predictions, dict)
            else {}
        )
        fps = metadata.get("fps") or 30
        for frame_number, scores in preds.items():
            unsafe_score = 0
            if isinstance(scores, dict):
                unsafe_score = scores.get("unsafe", 0) or 0
            if unsafe_score > unsafe_threshold:
                time_in_seconds = (
                    float(frame_number) /
                    float(fps) if fps else float(frame_number)
                )
                video_issues.append(
                    {
                        "time": time_in_seconds,
                        "type": "NAGOTA",
                        "details": f"Вероятность: {unsafe_score:.2f}",
                        "frame": frame_number,
                    }
                )
    all_issues = sorted(audio_issues + video_issues, key=lambda x: x["time"])
    is_nsfw = len(video_issues) > 0
    has_profanity = len(audio_issues) > 0
    verdict = "ok" if not all_issues else "flagged"
    return {
        "video_path": video_path,
        "is_nsfw": is_nsfw,
        "has_profanity": has_profanity,
        "verdict": verdict,
        "issues": all_issues,
    }


def _trim_text(text: str, limit: int = 800):
    if not text:
        return text
    return text[:limit]


def main():
    if len(sys.argv) < 2:
        print(json.dumps(
            {"error": "video_path is required"}, ensure_ascii=False))
        sys.exit(1)
    video_path = sys.argv[1]
    try:
        result = analyze_video(video_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        msg = str(e) or "Checker failed"
        msg = _trim_text(msg)
        print(json.dumps({"error": msg}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
