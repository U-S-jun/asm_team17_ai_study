"use client";

import { useMutation } from "@tanstack/react-query";
import { analyzeMeeting } from "./api";

export function useAnalyzeMeeting() {
  return useMutation({
    mutationFn: analyzeMeeting,
  });
}
