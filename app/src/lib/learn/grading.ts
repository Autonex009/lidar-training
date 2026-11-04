export type AnswerValue = number | boolean | null;

export interface GradableQuestion {
  id: string;
  correctAnswer: number | boolean;
}

export interface QuestionResult {
  questionId: string;
  answer: AnswerValue;
  correct: boolean;
}

export interface GradeResult {
  total: number;
  correctCount: number;
  /** Percent 0..100, one decimal. */
  score: number;
  passed: boolean;
  results: QuestionResult[];
}

/** Pure grading: unanswered or wrong-typed answers are incorrect. Passed when score >= threshold. */
export function gradeAnswers(questions: GradableQuestion[], answers: Record<string, AnswerValue>, passingScore: number): GradeResult {
  const results = questions.map((q) => {
    const a = answers[q.id] ?? null;
    return { questionId: q.id, answer: a, correct: a !== null && a === q.correctAnswer };
  });
  const correctCount = results.filter((r) => r.correct).length;
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 1000) / 10;
  return { total, correctCount, score, passed: total > 0 && score >= passingScore, results };
}
