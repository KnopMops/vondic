 "use client";
 
 import React from "react";
 
 type Props = {
   author: string;
   time: string;
   text: string;
   image?: string;
 };
 
 export default function Post({ author, time, text, image }: Props) {
   return (
     <article className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
       <div className="flex items-start gap-3">
         <div className="h-10 w-10 rounded-full bg-indigo-200 dark:bg-indigo-900/50" />
         <div className="flex-1">
           <div className="flex items-center gap-2">
             <span className="text-sm font-semibold text-gray-900 dark:text-white">{author}</span>
             <span className="text-xs text-gray-500 dark:text-gray-400">{time}</span>
           </div>
           <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{text}</p>
           {image && (
             <img
               src={image}
               alt=""
               className="mt-3 w-full rounded-lg"
             />
           )}
           <div className="mt-3 flex items-center gap-3">
             <button className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
               Нравится
             </button>
             <button className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
               Комментировать
             </button>
             <button className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
               Поделиться
             </button>
           </div>
         </div>
       </div>
     </article>
   );
 }
