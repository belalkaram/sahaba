<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Http\Controllers\Controller;
use App\Models\BankQuestion;
use App\Models\Course;
use App\Models\Exam;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class QuestionBankController extends Controller
{
    /**
     * List question banks for a course.
     */
    public function index(string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);
        $banks = $course->questionBanks()->withCount('questions')->get();

        return ApiResponse::success(['question_banks' => $banks]);
    }

    /**
     * Create a new question bank.
     */
    public function store(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $bank = $course->questionBanks()->create($validated);

        return ApiResponse::success(['question_bank' => $bank], Response::HTTP_CREATED);
    }

    /**
     * Get a specific question bank with its questions.
     */
    public function show(string $courseId, string $bankId): JsonResponse
    {
        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($bankId);
        $questions = $bank->questions()->get()->each(function ($q) {
            $q->makeVisible(['correct_answer', 'acceptable_answers']);
        });

        return ApiResponse::success([
            'question_bank' => $bank,
            'questions' => $questions,
        ]);
    }

    /**
     * Update question bank metadata.
     */
    public function update(Request $request, string $courseId, string $bankId): JsonResponse
    {
        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($bankId);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $bank->update($validated);

        return ApiResponse::success(['question_bank' => $bank]);
    }

    /**
     * Delete a question bank.
     */
    public function destroy(string $courseId, string $bankId): JsonResponse
    {
        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($bankId);
        $bank->delete();

        return ApiResponse::success(['message' => 'Question bank deleted successfully.']);
    }

    /**
     * Add a question to the question bank.
     */
    public function addQuestion(Request $request, string $courseId, string $bankId): JsonResponse
    {
        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($bankId);

        $validated = $request->validate([
            'question_text' => 'required|string',
            'question_type' => 'nullable|string|in:multiple_choice,multiple_select,true_false,short_answer,essay',
            'points' => 'nullable|numeric|min:0',
            'options' => 'nullable|array',
            'correct_answer' => 'nullable|string',
            'acceptable_answers' => 'nullable|array',
            'explanation' => 'nullable|string',
        ]);

        $question = $bank->questions()->create([
            'question_text' => $validated['question_text'],
            'question_type' => $validated['question_type'] ?? 'multiple_choice',
            'points' => $validated['points'] ?? 10.00,
            'options' => $validated['options'] ?? null,
            'correct_answer' => $validated['correct_answer'] ?? null,
            'acceptable_answers' => $validated['acceptable_answers'] ?? null,
            'explanation' => $validated['explanation'] ?? null,
        ]);

        $question->makeVisible(['correct_answer', 'acceptable_answers']);

        return ApiResponse::success(['question' => $question], Response::HTTP_CREATED);
    }

    /**
     * Update a question in the bank.
     */
    public function updateQuestion(Request $request, string $courseId, string $bankId, string $questionId): JsonResponse
    {
        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($bankId);
        $question = BankQuestion::where('bank_id', $bank->id)->findOrFail($questionId);

        $validated = $request->validate([
            'question_text' => 'sometimes|required|string',
            'question_type' => 'nullable|string|in:multiple_choice,multiple_select,true_false,short_answer,essay',
            'points' => 'nullable|numeric|min:0',
            'options' => 'nullable|array',
            'correct_answer' => 'nullable|string',
            'acceptable_answers' => 'nullable|array',
            'explanation' => 'nullable|string',
        ]);

        $question->update($validated);
        $question->makeVisible(['correct_answer', 'acceptable_answers']);

        return ApiResponse::success(['question' => $question]);
    }

    /**
     * Delete a question from the bank.
     */
    public function deleteQuestion(string $courseId, string $bankId, string $questionId): JsonResponse
    {
        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($bankId);
        $question = BankQuestion::where('bank_id', $bank->id)->findOrFail($questionId);
        $question->delete();

        return ApiResponse::success(['message' => 'Bank question deleted successfully.']);
    }

    /**
     * Import questions from a bank into an exam.
     */
    public function importToExam(Request $request, string $courseId, string $examId): JsonResponse
    {
        $exam = Exam::where('course_id', $courseId)->findOrFail($examId);

        $validated = $request->validate([
            'bank_id' => 'required|uuid|exists:tenant.question_banks,id',
            'question_ids' => 'nullable|array',
            'question_ids.*' => 'uuid|exists:tenant.bank_questions,id',
        ]);

        $bank = QuestionBank::where('course_id', $courseId)->findOrFail($validated['bank_id']);

        $query = $bank->questions();
        if (! empty($validated['question_ids'])) {
            $query->whereIn('id', $validated['question_ids']);
        }

        $bankQuestions = $query->get();
        if ($bankQuestions->isEmpty()) {
            return ApiResponse::error('NO_QUESTIONS_FOUND', 'No bank questions found to import.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $currentMaxOrder = $exam->questions()->max('sort_order') ?? 0;
        $imported = [];

        foreach ($bankQuestions as $bq) {
            $currentMaxOrder++;
            $q = $exam->questions()->create([
                'bank_id' => $bank->id,
                'question_text' => $bq->question_text,
                'question_type' => $bq->question_type,
                'points' => $bq->points,
                'options' => $bq->options,
                'correct_answer' => $bq->getRawOriginal('correct_answer'),
                'acceptable_answers' => $bq->acceptable_answers,
                'explanation' => $bq->explanation,
                'model_answer' => $bq->model_answer,
                'sort_order' => $currentMaxOrder,
            ]);
            $q->makeVisible(['correct_answer', 'acceptable_answers']);
            $imported[] = $q;
        }

        // Recalculate total exam points
        $exam->update(['total_points' => $exam->questions()->sum('points')]);

        return ApiResponse::success([
            'message' => count($imported).' questions imported successfully.',
            'imported_questions' => $imported,
            'exam' => $exam->fresh(),
        ], Response::HTTP_CREATED);
    }
}
