 "use client";
 
import React from "react";
import BrandLogo from "./BrandLogo";
 
 type Props = {
   email: string;
   onLogout: () => void;
 };
 
 export default function Header({ email, onLogout }: Props) {
   return (
     <header className="border-b border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-800">
         <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={28} />
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Vondic
          </span>
        </div>

        <div className="flex flex-1 justify-center px-4">
          <div className="hidden w-full max-w-md sm:block">
            <input
              type="text"
              placeholder="Поиск"
              className="w-full rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-700 sm:block dark:text-gray-300">{email}</span>
           <button
             className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
             onClick={onLogout}
           >
             Выйти
           </button>
         </div>
       </div>
     </header>
   );
 }
