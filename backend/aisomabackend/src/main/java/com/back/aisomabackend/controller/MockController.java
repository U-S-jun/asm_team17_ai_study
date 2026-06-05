package com.back.aisomabackend.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/mock")
public class MockController {

    @GetMapping(value = "/analyze", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> mockAnalyze() {
        String mockResponse = """
                {
                  "success": true,
                  "data": {
                    "status": "SUCCESS",
                    "summary": "팀원들이 홍대 저녁 약속에 대해 논의하였으며, 참가자 대부분이 금요일 오후 6시를 선호하였습니다.",
                    "recommendations": [
                      {
                        "rank": 1,
                        "datetime": "2024-02-16T18:00:00+09:00",
                        "location": "홍대입구역 2번 출구",
                        "menu": "파스타",
                        "confidence": 0.92,
                        "reason": "참가자 전원이 가능한 시간대이며, 가장 많이 언급된 장소입니다."
                      },
                      {
                        "rank": 2,
                        "datetime": "2024-02-17T18:00:00+09:00",
                        "location": "홍대입구역 2번 출구",
                        "menu": "고기",
                        "confidence": 0.78,
                        "reason": "2순위로 선호되는 시간대입니다."
                      },
                      {
                        "rank": 3,
                        "datetime": "2024-02-16T19:00:00+09:00",
                        "location": "홍대입구역 2번 출구",
                        "menu": "초밥",
                        "confidence": 0.65,
                        "reason": "일부 참가자가 여유있는 시간으로 제안하였습니다."
                      }
                    ]
                  },
                  "error": null,
                  "meta": {
                    "requestId": "%s",
                    "timestamp": "%s"
                  }
                }
                """.formatted(UUID.randomUUID(), Instant.now());

        return ResponseEntity.ok(mockResponse);
    }
}
