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
        log.info("분석 요청 수신 - 파일명: {}", conversationFile.getOriginalFilename());

        String filename = conversationFile.getOriginalFilename();
        byte[] fileBytes = conversationFile.getBytes();

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("conversationFile", new ByteArrayResource(fileBytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        });
        body.add("analysisRequest", analysisRequest);

        try {
            ResponseEntity<String> response = aiRestClient.post()
                    .uri("/api/analyze")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .toEntity(String.class);

            log.info("AI 서버 응답 - 상태코드: {}", response.getStatusCode());
            return response;

        } catch (HttpStatusCodeException e) {
            log.error("AI 서버 오류 - 상태코드: {}", e.getStatusCode());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());

        } catch (RestClientException e) {
            log.error("AI 서버 연결 오류: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("{\"success\":false,\"data\":null,\"error\":\"AI 서버에 연결할 수 없습니다.\",\"meta\":null}");
        }
    }
}