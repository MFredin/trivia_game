import { useCallback, useRef, useState } from 'react';
import { fetchNextQuestion, getSession, spendLifeline, submitAnswer } from '../../api/sessions.js';
import { describeFailure, withRetries } from '../../lib/requestRetry.js';

/**
 * A run: the fifteen pieces of state that describe one game in progress, and everything that
 * moves it forward.
 *
 * All of this used to live in App.jsx, which meant the reset that starts a run was written out
 * by hand four times — once each for starting a run, starting a challenge, accepting a duel,
 * and a duel starting over the socket. Four copies of fourteen `setX(...)` calls, any of which
 * could drift, and a new piece of run state had to be remembered in all four. `begin()` is
 * that reset, once.
 *
 * `onComplete` is called when the run is over on the server. This hook does not decide which
 * screen comes next — a duel ends somewhere different from a solo run, and the caller is what
 * knows the difference.
 */
export function useRun({ authToken, onComplete }) {
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [token, setToken] = useState(null);
  const [issuedAt, setIssuedAt] = useState(null);

  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [runCorrectness, setRunCorrectness] = useState([]);
  const [feedback, setFeedback] = useState(null);

  // A ref, not state: two taps on one question have to be refused between renders, and state
  // set in the first would not be visible to the second.
  const submitLockRef = useRef(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [answerError, setAnswerError] = useState(null);

  const [lifelinesUsed, setLifelinesUsed] = useState([]);
  const [hiddenChoices, setHiddenChoices] = useState([]);

  /** The one reset. Every way a run can start comes through here. */
  const begin = useCallback(({ session: newSession, question: firstQuestion, token: firstToken, issuedAt: at }) => {
    setSession(newSession);
    setQuestion(firstQuestion);
    setToken(firstToken);
    setIssuedAt(at);
    setStreak(0);
    setBestStreak(0);
    setStrikes(0);
    setTotalScore(0);
    setCorrectCount(0);
    setAnsweredCount(0);
    setRunCorrectness([]);
    setFeedback(null);
    setAnswerError(null);
    setLifelinesUsed([]);
    setHiddenChoices([]);
  }, []);

  /** Leaving a run behind — abandoned, finished with, or replaced by the next one. */
  const clear = useCallback(() => {
    setSession(null);
    setQuestion(null);
    setFeedback(null);
    setAnswerError(null);
  }, []);

  // A submission the server already recorded, whose response we never saw. Retrying it can
  // only ever 409 again, so read the run's real state instead of leaving the player stranded
  // on a question that is, as far as the server is concerned, behind them.
  const recoverFromStaleAnswer = useCallback(async () => {
    try {
      const live = await withRetries(() => getSession(session.id, authToken));
      if (live.status === 'completed') {
        setAnswerError(null);
        await onComplete(session);
        return true;
      }
      // Still running: the answer landed and the next question is ours to ask for.
      const next = await withRetries(() => fetchNextQuestion(session.id, authToken));
      setQuestion(next.question);
      setToken(next.token);
      setIssuedAt(next.issued_at);
      setHiddenChoices([]);
      setFeedback(null);
      setAnswerError(null);
      return true;
    } catch {
      return false;
    }
  }, [session, authToken, onComplete]);

  const submit = useCallback(
    async (chosenIndex, lifeline) => {
      if (submitLockRef.current || feedback) return;
      submitLockRef.current = true;
      setSubmitPending(true);
      setAnswerError(null);
      try {
        const result = await withRetries(() =>
          submitAnswer(session.id, { questionId: question.question_id, chosenIndex, token, lifeline }, authToken),
        );
        const correctIndex = question.choices.indexOf(result.correct_answer);
        setFeedback({
          correct: result.correct,
          timedOut: result.timed_out,
          points: result.points,
          correctIndex,
          chosenIndex,
          correctAnswer: result.correct_answer,
          explanation: result.explanation,
          sessionComplete: result.session_complete,
          skipped: Boolean(result.skipped),
          lifeline: result.lifeline ?? null,
        });
        if (result.session?.lifelines_used) setLifelinesUsed(result.session.lifelines_used);
        setStreak(result.streak);
        setBestStreak(result.session.best_streak);
        setStrikes(result.strikes);
        setTotalScore(result.running_total);
        setAnsweredCount((n) => n + 1);
        if (result.correct) setCorrectCount((n) => n + 1);
        setRunCorrectness((arr) => [...arr, result.correct]);
      } catch (err) {
        if (err.code === 'already_answered' || err.code === 'session_not_active') {
          const recovered = await recoverFromStaleAnswer();
          if (recovered) return;
          setAnswerError({
            message: 'That answer already reached us, but we lost the reply. Your run is safe.',
            retryable: false,
          });
          return;
        }
        setAnswerError({
          message: describeFailure(err, chosenIndex === -1 ? 'recording your timeout' : 'recording that answer'),
          retryable: true,
          chosenIndex,
          lifeline,
        });
      } finally {
        submitLockRef.current = false;
        setSubmitPending(false);
      }
    },
    [session, question, token, feedback, authToken, recoverFromStaleAnswer],
  );

  const continueToNext = useCallback(async () => {
    if (feedback.sessionComplete) {
      setAnswerError(null);
      await onComplete(session);
      return;
    }
    // Asking for the next question is what starts its clock, so it happens here — when the
    // player has finished reading and is ready — not back when they submitted the last answer.
    setAnswerError(null);
    setSubmitPending(true);
    try {
      const next = await withRetries(() => fetchNextQuestion(session.id, authToken));
      setQuestion(next.question);
      setToken(next.token);
      setIssuedAt(next.issued_at);
      // A 50-50 applies to one question only.
      setHiddenChoices([]);
      setFeedback(null);
    } catch (err) {
      if (err.code === 'session_not_active') {
        await onComplete(session);
        return;
      }
      setAnswerError({
        message: describeFailure(err, 'loading the next question'),
        retryable: true,
        continueInstead: true,
      });
    } finally {
      setSubmitPending(false);
    }
  }, [feedback, session, authToken, onComplete]);

  const fiftyFifty = useCallback(async () => {
    if (submitLockRef.current || feedback) return;
    setAnswerError(null);
    try {
      const result = await withRetries(() =>
        spendLifeline(session.id, { questionId: question.question_id, token, type: 'fifty_fifty' }, authToken),
      );
      setHiddenChoices(result.hidden_indices ?? []);
      setLifelinesUsed(result.lifelines_used ?? []);
    } catch (err) {
      // Already spent is not worth a panel; the button simply stops being offered once the
      // server's answer says so.
      if (err.code === 'lifeline_unavailable') {
        setLifelinesUsed((prev) => (prev.includes('fifty_fifty') ? prev : [...prev, 'fifty_fifty']));
        return;
      }
      setAnswerError({ message: describeFailure(err, 'using that lifeline'), retryable: false });
    }
  }, [feedback, session, question, token, authToken]);

  // Routed through submit so a skip gets the same submit lock, retries, error handling and
  // 409 recovery every other answer gets.
  const skip = useCallback(() => {
    if (lifelinesUsed.includes('skip')) return;
    submit(0, 'skip');
  }, [lifelinesUsed, submit]);

  const retry = useCallback(() => {
    if (!answerError?.retryable) return;
    if (answerError.continueInstead) {
      continueToNext();
      return;
    }
    submit(answerError.chosenIndex, answerError.lifeline);
  }, [answerError, continueToNext, submit]);

  return {
    session,
    question,
    token,
    issuedAt,
    streak,
    bestStreak,
    strikes,
    totalScore,
    correctCount,
    answeredCount,
    runCorrectness,
    feedback,
    submitPending,
    answerError,
    lifelinesUsed,
    hiddenChoices,
    begin,
    clear,
    submit,
    continueToNext,
    fiftyFifty,
    skip,
    retry,
    dismissError: () => setAnswerError(null),
  };
}
