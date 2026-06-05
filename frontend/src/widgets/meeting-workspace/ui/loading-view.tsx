"use client";

import { useEffect, useState } from "react";

const loadingMessages = ["결과 분석 중입니다", "점수 산정 중입니다"];

export function LoadingView() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length);
    }, 1200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative flex min-h-[560px] items-center justify-center rounded-lg border border-neutral-200 bg-white">
      <div className="w-full max-w-md px-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-teal-200 bg-teal-50">
          <div className="size-7 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-neutral-950">
          분석 대기
        </h2>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-teal-600" />
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-8 text-center text-sm font-semibold text-neutral-700">
        {loadingMessages[messageIndex]}
      </p>
    </div>
  );
}
