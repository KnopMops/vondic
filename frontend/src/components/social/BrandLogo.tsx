"use client";

import Image from "next/image";
import React from "react";

export default function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Вондик"
      width={size}
      height={size}
    />
  );
}
