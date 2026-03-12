
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CreateQuiz } from './pages/CreateQuiz';
import { TakeQuizList } from './pages/TakeQuizList';
import { TakeQuiz } from './pages/TakeQuiz';
import { Results } from './pages/Results';
import { ReviewList } from './pages/ReviewList';
import { ReviewAttempt } from './pages/ReviewAttempt';
import { ResultDetail } from './pages/ResultDetail';
import { EmployeeList } from './pages/EmployeeList';
import { EmployeeForm } from './pages/EmployeeForm';
import { ActiveQuizzes } from './pages/ActiveQuizzes';
import { EmployeeDetailResults } from './pages/EmployeeDetailResults';
import { TestValidation } from './pages/TestValidation';
import { ManagerTeam } from './pages/ManagerTeam';
import { Analytics } from './pages/Analytics';
import { Login } from './pages/Login';

const AppRoutes: React.FC = () => {
  const { currentUser } = useStore();

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const role = currentUser.role;

  return (
    <Layout>
      <Routes>
        {/* Общие маршруты для всех авторизованных */}
        <Route path="/results/:id" element={<ResultDetail />} />
        <Route path="/active" element={<ActiveQuizzes />} />
        <Route path="/take/:id" element={<TakeQuiz />} />
        <Route path="/results" element={<Results />} />

        {/* Маршруты Админа */}
        {role === 'admin' && (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateQuiz />} />
            <Route path="/edit/:id" element={<CreateQuiz />} />
            <Route path="/take" element={<TakeQuizList />} />
            <Route path="/review" element={<ReviewList />} />
            <Route path="/review/:id" element={<ReviewAttempt />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/employees/new" element={<EmployeeForm />} />
            <Route path="/employees/edit/:id" element={<EmployeeForm />} />
            <Route path="/employees/:id/results" element={<EmployeeDetailResults />} />
            <Route path="/validation" element={<TestValidation />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}

        {/* Маршруты Менеджера */}
        {role === 'manager' && (
          <>
            <Route path="/team" element={<ManagerTeam />} />
            <Route path="/team/:id/results" element={<EmployeeDetailResults />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/active" replace />} />
          </>
        )}

        {/* Маршруты Сотрудника */}
        {role === 'employee' && (
          <Route path="*" element={<Navigate to="/active" replace />} />
        )}
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <StoreProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </StoreProvider>
    </ThemeProvider>
  );
};

export default App;
