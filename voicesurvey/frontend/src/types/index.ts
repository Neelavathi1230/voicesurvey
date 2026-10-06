export interface User { id: number; name: string; email: string; created_at: string }
export interface Survey {
  id: number; slug: string; title: string; description: string; is_open: boolean;
  created_at: string; response_count: number | null; questions: { id: number; text: string }[];
}
export interface PublicSurvey {
  title: string; description: string; questions: { id: number; text: string }[]; server_transcription: boolean;
}
export interface SentimentCounts { positive: number; neutral: number; negative: number }
export interface Example { text: string; sentiment: string; score: number; input_type: string }
export interface QuestionResult {
  question_id: number; text: string; answer_count: number; sentiment: SentimentCounts;
  average_polarity: number; average_words: number; voice_answers: number;
  top_keywords: { term: string; count: number }[]; top_phrases: { term: string; count: number }[];
  most_negative: Example[]; most_positive: Example[];
}
export interface Results {
  survey: { id: number; title: string; slug: string; is_open: boolean };
  total_responses: number; total_answers: number; voice_answers: number; text_answers: number;
  sentiment: SentimentCounts; top_keywords: { term: string; count: number }[];
  per_day: { date: string; count: number }[]; questions: QuestionResult[];
}
