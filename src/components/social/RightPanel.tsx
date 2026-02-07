 "use client";
 
 import React from "react";
 
 export default function RightPanel() {
   const friends = ["Виктория", "Игорь", "Александра", "Максим"];
   return (
     <aside className="space-y-6">
       <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
         <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Друзья онлайн</h3>
         <div className="flex flex-wrap gap-3">
           {friends.map((f) => (
             <div key={f} className="flex flex-col items-center">
               <div className="relative h-10 w-10 rounded-full bg-indigo-200 dark:bg-indigo-900/50" />
               <span className="mt-1 text-xs text-gray-700 dark:text-gray-300">{f}</span>
             </div>
           ))}
         </div>
       </div>
       <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
         <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Рекомендуем</h3>
         <div className="grid grid-cols-2 gap-3">
           <div className="rounded-lg bg-orange-100 p-3 text-sm text-gray-800 dark:bg-orange-900/30 dark:text-gray-200">
             Новинки кино
           </div>
           <div className="rounded-lg bg-green-100 p-3 text-sm text-gray-800 dark:bg-green-900/30 dark:text-gray-200">
             Фитнес и здоровье
           </div>
         </div>
       </div>
     </aside>
   );
 }
