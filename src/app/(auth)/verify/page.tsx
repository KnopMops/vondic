"use client";

import Link from "next/link";
import BrandLogo from "@/components/social/BrandLogo";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-gray-800 p-8 shadow-xl text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <BrandLogo size={48} />
          <h2 className="text-2xl font-bold text-white">Подтвердите Email</h2>
        </div>
        
        <div className="space-y-4 text-gray-300">
          <p>
            Мы отправили письмо с подтверждением на вашу электронную почту.
          </p>
          <p>
            Пожалуйста, перейдите по ссылке в письме, чтобы активировать аккаунт.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex w-full justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  );
}
