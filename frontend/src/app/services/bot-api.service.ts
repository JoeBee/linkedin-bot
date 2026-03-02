import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:3000/api';

export interface BotState {
  status: 'idle' | 'logging_in' | 'ready' | 'error';
  error?: string;
  conversations: ConversationSummary[];
  jobs: JobListing[];
}

export interface ConversationSummary {
  id: string;
  name: string;
  preview: string;
  unread: boolean;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  postedDate: string;
  salary?: string;
  jobUrl: string;
  description?: string;
  applyUrl?: string;
}

export interface RefreshDiagnostics {
  raceWinner: 'api' | 'skeleton';
  apiUrl?: string;
  rawApiResponse?: unknown;
  rawApiTopKeys?: string[];
  rawApiStructure?: string;
  parsePathUsed?: string;
  parsedCount: number;
  domSummary?: {
    threadLinks: number;
    messagingLinks: number;
    inboxLinks: number;
    hasSkeleton: boolean;
    hasMessagingHeader: boolean;
    linkInfo?: Array<{ href: string | null; text: string; parentTag: string; parentClass: string }>;
  };
  voyagerUrlsSeen?: string[];
}

@Injectable({ providedIn: 'root' })
export class BotApiService {
  constructor(private http: HttpClient) {}

  getStatus(): Observable<BotState> {
    return this.http.get<BotState>(`${API}/bot/status`);
  }

  login(email: string, password: string, headless: boolean): Observable<{ ok: boolean; message?: string }> {
    return this.http.post<{ ok: boolean; message?: string }>(`${API}/bot/login`, {
      email,
      password,
      headless,
    });
  }

  refreshConversations(): Observable<{ conversations: ConversationSummary[]; diagnostics: RefreshDiagnostics }> {
    return this.http.post<{ conversations: ConversationSummary[]; diagnostics: RefreshDiagnostics }>(
      `${API}/bot/conversations/refresh`,
      {}
    );
  }

  getDiagnostics(): Observable<RefreshDiagnostics> {
    return this.http.get<RefreshDiagnostics>(`${API}/bot/diagnostics`);
  }

  openConversation(id: string): Observable<{ ok: boolean; messages?: Array<{ text: string; timestamp?: string; fromMe?: boolean }> }> {
    return this.http.post<{ ok: boolean; messages?: Array<{ text: string; timestamp?: string; fromMe?: boolean }> }>(`${API}/bot/conversations/${id}/open`, {});
  }

  sendMessage(text: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${API}/bot/send`, { text });
  }

  logout(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${API}/bot/logout`, {});
  }

  generateReply(
    conversationHistory: Array<{ text: string; fromMe?: boolean; timestamp?: string }>,
    recipientName: string
  ): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${API}/bot/generate-reply`, {
      conversationHistory,
      recipientName,
    });
  }

  searchJobs(
    keywords: string,
    location?: string,
    distance?: number,
    easyApply?: boolean,
    generativeAI?: boolean,
    experienceLevels?: string[],
    jobTypes?: string[],
    workLocations?: string[],
    datePosted?: string,
    salaryMin?: string,
    under10Applicants?: boolean
  ): Observable<{ jobs: JobListing[] }> {
    return this.http.post<{ jobs: JobListing[] }>(`${API}/jobs/search`, { 
      keywords,
      location,
      distance,
      easyApply,
      generativeAI,
      experienceLevels,
      jobTypes,
      workLocations,
      datePosted,
      salaryMin,
      under10Applicants
    });
  }

  getJobs(): Observable<{ jobs: JobListing[] }> {
    return this.http.get<{ jobs: JobListing[] }>(`${API}/jobs`);
  }

  getJobDetails(jobId: string): Observable<{ job: JobListing }> {
    return this.http.get<{ job: JobListing }>(`${API}/jobs/${jobId}`);
  }

  applyToJob(jobId: string): Observable<{ ok: boolean; message?: string }> {
    return this.http.post<{ ok: boolean; message?: string }>(`${API}/jobs/${jobId}/apply`, {});
  }

  getAppliedJobs(): Observable<{ jobs: JobListing[] }> {
    return this.http.get<{ jobs: JobListing[] }>(`${API}/jobs/applied`);
  }
}
