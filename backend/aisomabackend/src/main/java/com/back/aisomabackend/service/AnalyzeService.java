package com.back.aisomabackend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyzeService {

    private final RestClient aiRestClient;

    public ResponseEntity<String> forward(MultipartFile conversationFile, String analysisRequest) throws IOException {
        long startedAt = System.nanoTime();

        String filename = conversationFile.getOriginalFilename();
        byte[] fileBytes = conversationFile.getBytes();
        int requestLength = analysisRequest == null ? 0 : analysisRequest.length();
        log.info(
                "분석 요청 수신 - 파일명: {}, 파일크기: {} bytes, analysisRequestLength: {} chars",
                filename,
                fileBytes.length,
                requestLength
        );

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("conversationFile", new ByteArrayResource(fileBytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        });
        body.add("analysisRequest", analysisRequest);

        try {
            log.info("AI 서버 요청 전송 - endpoint: /api/analyze");
            ResponseEntity<String> response = aiRestClient.post()
                    .uri("/api/analyze")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .toEntity(String.class);

            log.info(
                    "AI 서버 응답 - 상태코드: {}, elapsed={}ms",
                    response.getStatusCode(),
                    elapsedMillis(startedAt)
            );
            return response;

        } catch (HttpStatusCodeException e) {
            log.error(
                    "AI 서버 오류 - 상태코드: {}, elapsed={}ms",
                    e.getStatusCode(),
                    elapsedMillis(startedAt)
            );
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());

        } catch (RestClientException e) {
            log.error(
                    "AI 서버 연결 오류: {}, elapsed={}ms",
                    e.getMessage(),
                    elapsedMillis(startedAt)
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("{\"success\":false,\"data\":null,\"error\":\"AI 서버에 연결할 수 없습니다.\",\"meta\":null}");
        }
    }

    private long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
