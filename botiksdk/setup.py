from setuptools import setup

setup(
    name="botiksdk",
    version="0.5.1",
    description="Python SDK for Vontic Bot Platform (aiogram-style API)",
    packages=["botiksdk"],
    install_requires=[
        "requests>=2.28.0",
        "aiohttp>=3.8.0",
    ],
    python_requires=">=3.9",
)
