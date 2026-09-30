import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/Home";
import Collect from "./pages/Collect";
import Tasks from "./pages/Tasks";
import Guide from "./pages/Guide";
import Trust from "./pages/Trust";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

function TaskDetailRedirect() {
  const { taskId } = useParams<{ taskId: string }>();
  return <Navigate to={`/collect/${taskId}`} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/collect" element={<Collect />} />
            <Route path="/collect/:taskId" element={<Collect />} />
            <Route path="/tasks/:taskId" element={<TaskDetailRedirect />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/trust" element={<Trust />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
