
export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  OPEN_ENDED = 'OPEN_ENDED',
  RANGE = 'RANGE'
}

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswers: number[];
  difficulty?: QuestionDifficulty;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  group: string;     
  product: string;   
  createdAt: number;
  questions: Question[];
  isSession?: boolean;      
  isArchived?: boolean;     
  timeLimit?: number;       
  availableFrom?: number;   
  availableUntil?: number;  
  passThreshold?: number;   // проходной балл в % (по умолчанию 60)
  tags?: string[];          // теги для фильтрации
}

export type AttemptStatus = 'pending' | 'completed';

export interface AttemptResult {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  score: number;
  maxPossibleScore: number;
  percentage: number;
  date: number;
  status: AttemptStatus;
  answers: Record<string, number[] | string | { from: string, to: string }>;
  questions?: Question[]; 
  manualScores?: Record<string, number>;
  manualComments?: Record<string, string>;
  violations?: number; 
  violationDetails?: string[];
  timeSpent?: number; // Время прохождения в секундах
}

export interface Employee {
  id: string;
  fullName: string;
  login: string;
  password?: string;
  group: string;       // все группы через запятую (для отображения и старых назначений)
  groups?: string[];   // все группы сотрудника
  area: string;
  positionId: string;
  role: 'admin' | 'employee' | 'manager'; 
  managedArea?: string;      
  managedAreas?: string[];   
  managedGroups?: string[];  
  createdAt: number;
}

export interface Position {
  id: string;
  name: string;
}

export type AssignmentTargetType = 'ALL' | 'AREA' | 'GROUP' | 'AREA_GROUP' | 'INDIVIDUAL';

export interface Assignment {
  id: string;
  quizId: string;
  targetType: AssignmentTargetType;
  targetArea?: string;
  targetGroup?: string;
  targetEmployeeId?: string;
  assignedAt: number;
  isRetake?: boolean;
}

/** Допустимое число нарушений во время аттестации; следующее аннулирует тест */
export const MAX_VIOLATIONS = 3;
