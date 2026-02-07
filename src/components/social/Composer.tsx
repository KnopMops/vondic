 "use client";
 
 import React, { useState } from "react";
 
 type Props = {
   onCreate: (text: string) => void;
 };
 
 export default function Composer({ onCreate }: Props) {
   const [text, setText] = useState("");
 
   const submit = () => {
     if (!text.trim()) return;
     onCreate(text.trim());
     setText("");
   };
 
   return (
     <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
       <input
         value={text}
         onChange={(e) => setText(e.target.value)}
         placeholder="Что у вас нового?"
         className="w-full rounded-md border-0 bg-gray-100 px-3 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600"
       />
       <div className="mt-3 flex items-center gap-3">
         <button
           onClick={submit}
           className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
         >
           Опубликовать
         </button>
         <button className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
           Фото
         </button>
         <button className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
           Видео
         </button>
       </div>
     </div>
   );
 }
