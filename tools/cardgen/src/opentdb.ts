import { createHash } from 'node:crypto';

/* Two things matter here and nowhere else in the project: the rate limit (one request per five seconds) and the session token, which is what stops the API
returning the same question twice inside a run */

const BASE = 'https://opentdb.com';
const MIN_INTERVAL_MS = 5_200;

let lastRequestAt = 0;

async function throttled<T>(url: string): Promise<T> {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (wait > 0) 
    await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  const response = await fetch(url, { headers: { 'User-Agent': 'wkb-cardgen/1.0' } });
  if (!response.ok) 
    throw new Error(`OpenTDB ${response.status} for ${url}`);
  return (await response.json()) as T;
}

export interface GlobalCounts {
  overall: {
    total_num_of_questions: number;
    total_num_of_verified_questions: number;
    total_num_of_pending_questions: number;
    total_num_of_rejected_questions: number;
  };
  categories: Record<string, { total_num_of_verified_questions: number }>;
}

export interface CategoryList {
  trivia_categories: { id: number; name: string }[];
}

export interface RawQuestion {
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface QuestionResponse {
  response_code: number;
  results: RawQuestion[];
}

export async function globalCounts(): Promise<GlobalCounts> {
  return throttled<GlobalCounts>(`${BASE}/api_count_global.php`);
}

export async function categories(): Promise<CategoryList> {
  return throttled<CategoryList>(`${BASE}/api_category.php`);
}

export async function categoryCount(id: number): Promise<number> {
  const payload = await throttled<{
    category_question_count: { total_question_count: number };
  }>(`${BASE}/api_count.php?category=${id}`);
  return payload.category_question_count.total_question_count;
}

export async function newSessionToken(): Promise<string> {
  const payload = await throttled<{ token: string }>(`${BASE}/api_token.php?command=request`);
  return payload.token;
}

export interface FetchResult {
  questions: RawQuestion[];
  responseCode: number;
}

export async function fetchQuestions(params: {
  token: string;
  amount: number;
  categoryId?: number;
  type?: 'boolean' | 'multiple';
}): Promise<FetchResult> {
  const query = new URLSearchParams({
    amount: String(Math.min(50, params.amount)),
    token: params.token,
    encode: 'url3986',
  });
  if (params.categoryId) 
    query.set('category', String(params.categoryId));
  if (params.type) 
    query.set('type', params.type);
  const payload = await throttled<QuestionResponse>(`${BASE}/api.php?${query.toString()}`);
  return {
    responseCode: payload.response_code,
    questions: (payload.results ?? []).map((question) => ({
      ...question,
      question: decodeURIComponent(question.question),
      correct_answer: decodeURIComponent(question.correct_answer),
      incorrect_answers: question.incorrect_answers.map((answer) => decodeURIComponent(answer)),
      category: decodeURIComponent(question.category),
    })),
  };
}

export function questionId(question: RawQuestion): string {
  return createHash('sha256')
    .update(`${question.question}|${question.correct_answer}`)
    .digest('hex');
}
