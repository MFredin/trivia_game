import { request } from './request.js';

export function startPreview() {
  return request('/preview/start', { method: 'POST' });
}

export function answerPreview({ previewId, questionId, chosenIndex, token, issuedAt, position }) {
  return request('/preview/answer', {
    method: 'POST',
    body: JSON.stringify({
      preview_id: previewId,
      question_id: questionId,
      chosen_index: chosenIndex,
      token,
      issued_at: issuedAt,
      position,
    }),
  });
}
