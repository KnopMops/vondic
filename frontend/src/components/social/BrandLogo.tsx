"use client";

import React from "react";
export default function BrandLogo({ size = 28 }: { size?: number }) {
   return (
     <svg
       width={size}
       height={size}
       viewBox="0 0 64 64"
       xmlns="http://www.w3.org/2000/svg"
     >
       <defs>
         <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0%" stopColor="#00D1FF" />
           <stop offset="100%" stopColor="#9B5EFF" />
         </linearGradient>
       </defs>
       <path
         d="M8 8 L24 8 L32 28 L40 8 L56 8 L36 56 L28 56 Z"
         fill="url(#g1)"
       />
     </svg>
   );
 }
