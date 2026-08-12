from setuptools import setup

setup(
    name="botiksdk",
    version="0.5.2",
    description="Python SDK для Vontic Bot Platform — с поддержкой aiogram-style API. Подробная документация: https://vondic.ru/api-docs",
    packages=["botiksdk"],
    install_requires=[
        "requests>=2.28.0",
        "aiohttp>=3.8.0",
    ],
    python_requires=">=3.9",
)
