import os
from typing import Optional

try:
    import torch
    from diffusers import StableDiffusionPipeline
    _HAS_DIFFUSERS = True
except Exception:
    _HAS_DIFFUSERS = False

from PIL import Image, ImageDraw


class Text2Image:
    def __init__(self, model_id: str = "runwayml/stable-diffusion-v1-5", device: Optional[str] = None):
        self.model_id = model_id
        if device:
            self.device = device
        else:
            if _HAS_DIFFUSERS and hasattr(torch, "cuda") and torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"
        self.pipe = None
        if _HAS_DIFFUSERS:
            dtype = torch.float16 if self.device == "cuda" else torch.float32
            self.pipe = StableDiffusionPipeline.from_pretrained(self.model_id, torch_dtype=dtype)
            self.pipe = self.pipe.to(self.device)

    def generate(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        num_inference_steps: int = 30,
        guidance_scale: float = 7.5,
        width: int = 512,
        height: int = 512,
        seed: Optional[int] = None,
    ) -> Image.Image:
        if self.pipe:
            generator = None
            if seed is not None:
                generator = torch.Generator(device=self.device).manual_seed(seed)
            image = self.pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                height=height,
                width=width,
                generator=generator,
            ).images[0]
            return image
        img = Image.new("RGB", (width, height), (240, 240, 240))
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), prompt[:200], fill=(0, 0, 0))
        return img

    def save(self, image: Image.Image, path: str) -> None:
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        image.save(path)
