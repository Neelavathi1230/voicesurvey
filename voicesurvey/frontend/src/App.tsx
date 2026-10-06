import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AuthPage from "./pages/AuthPage";
import NewSurveyPage from "./pages/NewSurveyPage";
import RespondPage from "./pages/RespondPage";
import ResultsPage from "./pages/ResultsPage";
import SurveysPage from "./pages/SurveysPage";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Loading…</p>;
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/s/:slug" element={<RespondPage />} />
      <Route element={user ? <AppLayout /> : <Navigate to="/" replace />}>
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/surveys/new" element={<NewSurveyPage />} />
        <Route path="/surveys/:id/results" element={<ResultsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
