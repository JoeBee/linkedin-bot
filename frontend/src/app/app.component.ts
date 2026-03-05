import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BotApiService,
  BotState,
  ConversationSummary,
  RefreshDiagnostics,
  JobListing,
} from './services/bot-api.service';

import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  state: BotState = { status: 'idle', conversations: [], jobs: [] };
  email = environment.defaultEmail;
  password = environment.defaultPassword;
  passwordVisible = false;
  headless = true;
  messageText = '';
  textareaRows = 3;
  loading = false;
  error = '';
  success = '';
  diagnostics: RefreshDiagnostics | null = null;
  diagnosticsExpanded = false;
  selectedConversation: ConversationSummary | null = null;
  threadMessages: Array<{ text: string; timestamp?: string; fromMe?: boolean }> = [];
  conversationFilter: 'all' | 'unread' = 'all';
  filterText = '';
  statusMessage = 'Idle';
  activeTab: 'conversations' | 'jobs' | 'appliedJobs' = 'conversations';

  // Jobs tab state
  jobSearchKeywords = 'pet sitting';
  jobLocation = 'Concord, MA';
  jobDistance = 20;
  easyApplyOnly = true;
  generativeAIFilter = false;
  filtersExpanded = true;

  // Experience level filters
  experienceInternship = false;
  experienceEntryLevel = true;
  experienceAssociate = false;
  experienceMidSenior = true;
  experienceDirector = true;
  experienceExecutive = true;

  // Job type filters
  jobTypeFullTime = true;
  jobTypePartTime = true;
  jobTypeContract = true;
  jobTypeTemporary = true;
  jobTypeVolunteer = false;
  jobTypeInternship = false;

  // Work location filters
  workOnSite = true;
  workRemote = true;
  workHybrid = true;

  // Date posted filter
  datePosted = 'r604800'; // Past week

  // Salary filter
  salaryMin = ''; // Any

  // Under 10 applicants
  under10Applicants = true;

  selectedJob: JobListing | null = null;
  showJobDetailsDialog = false;
  appliedJobs: JobListing[] = [];

  constructor(private api: BotApiService) {
    this.pollStatus();
  }

  setActiveTab(tab: 'conversations' | 'jobs' | 'appliedJobs'): void {
    this.activeTab = tab;
    if (tab === 'appliedJobs') {
      this.loadAppliedJobs();
    }
  }

  toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
  }

  toggleAllExperience(): void {
    const allChecked = this.experienceInternship && this.experienceEntryLevel &&
      this.experienceAssociate && this.experienceMidSenior &&
      this.experienceDirector && this.experienceExecutive;
    const newValue = !allChecked;
    this.experienceInternship = newValue;
    this.experienceEntryLevel = newValue;
    this.experienceAssociate = newValue;
    this.experienceMidSenior = newValue;
    this.experienceDirector = newValue;
    this.experienceExecutive = newValue;
  }

  toggleAllJobType(): void {
    const allChecked = this.jobTypeFullTime && this.jobTypePartTime &&
      this.jobTypeContract && this.jobTypeTemporary &&
      this.jobTypeVolunteer && this.jobTypeInternship;
    const newValue = !allChecked;
    this.jobTypeFullTime = newValue;
    this.jobTypePartTime = newValue;
    this.jobTypeContract = newValue;
    this.jobTypeTemporary = newValue;
    this.jobTypeVolunteer = newValue;
    this.jobTypeInternship = newValue;
  }

  toggleAllWorkLocation(): void {
    const allChecked = this.workOnSite && this.workRemote && this.workHybrid;
    const newValue = !allChecked;
    this.workOnSite = newValue;
    this.workRemote = newValue;
    this.workHybrid = newValue;
  }

  pollStatus(): void {
    this.api.getStatus().subscribe({
      next: (s) => (this.state = s),
      error: () => (this.state = { status: 'idle', conversations: [], jobs: [] }),
    });
  }

  login(): void {
    this.error = '';
    this.success = '';
    if (!this.email.trim() || !this.password) {
      this.error = 'Enter email and password';
      return;
    }
    this.loading = true;
    this.statusMessage = 'Logging in to LinkedIn...';
    this.api.login(this.email.trim(), this.password, this.headless).subscribe({
      next: () => {
        this.loading = false;
        this.pollStatus();
        this.statusMessage = 'Logged in - Ready';
        this.success = 'Logged in successfully. Click "Refresh conversations" to load your messages.';
      },
      error: (err) => {
        this.error = err?.error?.error || 'Login failed';
        this.statusMessage = 'Login failed';
        this.loading = false;
        this.pollStatus();
      },
    });
  }

  refresh(): void {
    this.error = '';
    this.success = '';
    this.diagnostics = null;
    this.loading = true;
    this.statusMessage = 'Loading conversations...';
    this.api.refreshConversations().subscribe({
      next: (res) => {
        this.state.conversations = res.conversations || [];
        this.diagnostics = res.diagnostics ?? null;
        this.success = `Loaded ${this.state.conversations.length} conversations.`;
        this.statusMessage = `Ready - ${this.state.conversations.length} conversations loaded`;
        this.loading = false;

        // Auto-select and generate for specified contact
        this.autoSelectContact();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Refresh failed';
        this.statusMessage = 'Error loading conversations';
        this.loading = false;
      },
    });
  }

  private autoSelectContact(firstName: string = 'Lucy', lastName: string = 'So'): void {
    const contact = this.state.conversations.find(c => {
      const nameLower = c.name.toLowerCase();
      return nameLower.includes(firstName.toLowerCase()) && nameLower.includes(lastName.toLowerCase());
    });

    if (contact) {
      // Open the conversation
      this.error = '';
      this.success = '';
      this.loading = true;
      this.threadMessages = [];
      this.messageText = '';
      this.textareaRows = 3;
      this.statusMessage = `Loading messages from ${contact.name}...`;

      this.api.openConversation(contact.id).subscribe({
        next: (res) => {
          this.selectedConversation = contact;
          this.threadMessages = (res.messages ?? []).map((m) =>
            typeof m === 'string' ? { text: m } : { text: m.text, timestamp: m.timestamp, fromMe: m.fromMe }
          );
          this.success = `Opened conversation with ${contact.name}.`;
          this.statusMessage = `Conversation with ${contact.name} - ${this.threadMessages.length} messages loaded`;
          this.loading = false;

          // Check if the most recent message is from the contact (not from me)
          if (this.threadMessages.length > 0) {
            const mostRecentMessage = this.threadMessages[this.threadMessages.length - 1];
            const isFromContact = !mostRecentMessage.fromMe;

            if (isFromContact) {
              this.success = `Opened conversation with ${contact.name}. Auto-generating reply...`;

              // Small delay to ensure UI is updated
              setTimeout(() => {
                this.generateAiReply();
              }, 500);
            } else {
              this.success = `Opened conversation with ${contact.name}. Last message was from you.`;
            }
          }
        },
        error: (err) => {
          this.error = err?.error?.error || 'Failed to open';
          this.statusMessage = 'Error loading messages';
          this.loading = false;
        },
      });
    }
  }

  toggleDiagnostics(): void {
    this.diagnosticsExpanded = !this.diagnosticsExpanded;
  }

  private async copyToClipboard(text: string, target: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      const btn = target.closest('button');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.remove('copied');
        }, 1500);
      }
    } catch {
      /* clipboard failed */
    }
  }

  copyDiagnostics(event: Event): void {
    if (!this.diagnostics) return;
    const target = event.target as HTMLElement;
    const parts: string[] = [
      `Race winner: ${this.diagnostics.raceWinner}`,
      `Parse path: ${this.diagnostics.parsePathUsed ?? '—'}`,
      `Parsed count: ${this.diagnostics.parsedCount}`,
    ];
    if (this.diagnostics.apiUrl) parts.push(`API URL: ${this.diagnostics.apiUrl}`);
    if (this.diagnostics.rawApiTopKeys?.length) parts.push(`Top keys: ${this.diagnostics.rawApiTopKeys.join(', ')}`);
    if (this.diagnostics.rawApiStructure) parts.push(`Structure: ${this.diagnostics.rawApiStructure}`);
    if (this.diagnostics.domSummary) {
      parts.push(`DOM: threadLinks=${this.diagnostics.domSummary.threadLinks}, messagingLinks=${this.diagnostics.domSummary.messagingLinks}, inboxLinks=${this.diagnostics.domSummary.inboxLinks}, hasSkeleton=${this.diagnostics.domSummary.hasSkeleton}, hasMessagingHeader=${this.diagnostics.domSummary.hasMessagingHeader}`);
    }
    if (this.diagnostics.voyagerUrlsSeen?.length) {
      parts.push(`Voyager URLs:\n${this.diagnostics.voyagerUrlsSeen.slice(0, 10).join('\n')}`);
    }
    if (this.diagnostics.rawApiResponse) {
      parts.push(`Raw API response:\n${this.rawApiJson}`);
    }
    this.copyToClipboard(parts.join('\n'), target);
  }

  copySection(event: Event, section: 'dom' | 'voyager' | 'rawApi'): void {
    const target = event.target as HTMLElement;
    if (!this.diagnostics) return;
    let text = '';
    if (section === 'dom' && this.diagnostics.domSummary) {
      text = `threadLinks=${this.diagnostics.domSummary.threadLinks}, messagingLinks=${this.diagnostics.domSummary.messagingLinks}, inboxLinks=${this.diagnostics.domSummary.inboxLinks}, hasSkeleton=${this.diagnostics.domSummary.hasSkeleton}, hasMessagingHeader=${this.diagnostics.domSummary.hasMessagingHeader}`;
    } else if (section === 'voyager' && this.diagnostics.voyagerUrlsSeen?.length) {
      text = this.diagnostics.voyagerUrlsSeen.slice(0, 10).join('\n');
    } else if (section === 'rawApi' && this.diagnostics.rawApiResponse) {
      text = this.rawApiJson;
    }
    if (text) this.copyToClipboard(text, target);
  }

  get filteredConversations(): ConversationSummary[] {
    let list = this.state.conversations;
    if (this.conversationFilter === 'unread') {
      list = list.filter((c) => c.unread);
    }
    if (this.filterText.trim()) {
      const q = this.filterText.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q));
    }
    return list;
  }

  get reversedThreadMessages(): Array<{ text: string; timestamp?: string; fromMe?: boolean }> {
    return [...this.threadMessages].reverse();
  }

  get rawApiJson(): string {
    if (!this.diagnostics?.rawApiResponse) return '';
    try {
      return JSON.stringify(this.diagnostics.rawApiResponse, null, 2);
    } catch {
      return String(this.diagnostics.rawApiResponse);
    }
  }

  openConv(c: ConversationSummary): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.threadMessages = [];
    this.messageText = '';
    this.textareaRows = 3;
    this.statusMessage = `Loading messages from ${c.name}...`;
    this.api.openConversation(c.id).subscribe({
      next: (res) => {
        this.selectedConversation = c;
        this.threadMessages = (res.messages ?? []).map((m) =>
          typeof m === 'string' ? { text: m } : { text: m.text, timestamp: m.timestamp, fromMe: m.fromMe }
        );
        this.success = `Opened conversation with ${c.name}. You can send a message below.`;
        this.statusMessage = `Conversation with ${c.name} - ${this.threadMessages.length} messages loaded`;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to open';
        this.statusMessage = 'Error loading messages';
        this.loading = false;
      },
    });
  }

  send(): void {
    this.error = '';
    this.success = '';
    const text = this.messageText.trim();
    if (!text) {
      this.error = 'Enter a message';
      return;
    }
    this.loading = true;
    this.api.sendMessage(text).subscribe({
      next: (res) => {
        if (res.ok) {
          this.success = 'Message sent.';
          const now = new Date();
          const timestamp = now.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
          this.threadMessages = [...this.threadMessages, { text, timestamp, fromMe: true }];
        } else this.error = 'Send failed.';
        this.loading = false;
        this.messageText = '';
      },
      error: (err) => {
        this.error = err?.error?.error || 'Send failed';
        this.loading = false;
      },
    });
  }

  logout(): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.api.logout().subscribe({
      next: () => {
        this.state = { status: 'idle', conversations: [], jobs: [] };
        this.selectedConversation = null;
        this.threadMessages = [];
        this.success = 'Logged out.';
        this.loading = false;
      },
      error: () => {
        this.state = { status: 'idle', conversations: [], jobs: [] };
        this.selectedConversation = null;
        this.threadMessages = [];
        this.loading = false;
      },
    });
  }

  generateAiReply(): void {
    if (!this.selectedConversation) {
      this.error = 'No conversation selected';
      return;
    }

    if (this.threadMessages.length === 0) {
      this.error = 'No messages to analyze';
      return;
    }

    this.error = '';
    this.success = '';
    this.loading = true;
    this.statusMessage = `Generating AI reply for ${this.selectedConversation.name}...`;

    this.api.generateReply(
      this.threadMessages,
      this.selectedConversation.name
    ).subscribe({
      next: (res) => {
        this.messageText = res.reply;
        this.success = 'AI reply generated! Review and edit before sending.';
        this.statusMessage = `AI reply generated for ${this.selectedConversation?.name}`;
        this.loading = false;

        // Calculate appropriate textarea height based on content
        const lines = res.reply.split('\n').length;
        const estimatedLines = Math.max(8, Math.min(15, lines + 2));  // Between 8-15 rows
        this.textareaRows = estimatedLines;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to generate AI reply';
        this.statusMessage = 'AI generation failed';
        this.loading = false;
      },
    });
  }

  searchJobs(): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.statusMessage = 'Searching for jobs...';

    // Build experience level array
    const experienceLevels: string[] = [];
    if (this.experienceInternship) experienceLevels.push('1');
    if (this.experienceEntryLevel) experienceLevels.push('2');
    if (this.experienceAssociate) experienceLevels.push('3');
    if (this.experienceMidSenior) experienceLevels.push('4');
    if (this.experienceDirector) experienceLevels.push('5');
    if (this.experienceExecutive) experienceLevels.push('6');

    // Build job type array
    const jobTypes: string[] = [];
    if (this.jobTypeFullTime) jobTypes.push('F');
    if (this.jobTypePartTime) jobTypes.push('P');
    if (this.jobTypeContract) jobTypes.push('C');
    if (this.jobTypeTemporary) jobTypes.push('T');
    if (this.jobTypeVolunteer) jobTypes.push('V');
    if (this.jobTypeInternship) jobTypes.push('I');

    // Build work location array
    const workLocations: string[] = [];
    if (this.workOnSite) workLocations.push('1');
    if (this.workRemote) workLocations.push('2');
    if (this.workHybrid) workLocations.push('3');

    this.api.searchJobs(
      this.jobSearchKeywords.trim(),
      this.jobLocation,
      this.jobDistance,
      this.easyApplyOnly,
      this.generativeAIFilter,
      experienceLevels,
      jobTypes,
      workLocations,
      this.datePosted,
      this.salaryMin,
      this.under10Applicants
    ).subscribe({
      next: (res) => {
        this.state.jobs = res.jobs || [];
        this.success = `Found ${this.state.jobs.length} jobs.`;
        this.statusMessage = `Ready - ${this.state.jobs.length} jobs found`;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Job search failed';
        this.statusMessage = 'Error searching jobs';
        this.loading = false;
      },
    });
  }

  loadAppliedJobs(): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.statusMessage = 'Loading applied jobs...';

    this.api.getAppliedJobs().subscribe({
      next: (res) => {
        this.appliedJobs = res.jobs || [];
        this.success = `Loaded ${this.appliedJobs.length} applied jobs.`;
        this.statusMessage = `Ready - ${this.appliedJobs.length} applied jobs`;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to load applied jobs';
        this.statusMessage = 'Error loading applied jobs';
        this.loading = false;
      },
    });
  }

  openJobDetails(job: JobListing): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.statusMessage = `Loading details for ${job.title}...`;

    this.api.getJobDetails(job.id).subscribe({
      next: (res) => {
        this.selectedJob = res.job;
        this.showJobDetailsDialog = true;
        this.statusMessage = 'Job details loaded';
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to load job details';
        this.statusMessage = 'Error loading job details';
        this.loading = false;
        this.selectedJob = job;
        this.showJobDetailsDialog = true;
      },
    });
  }

  closeJobDetailsDialog(): void {
    this.showJobDetailsDialog = false;
    this.selectedJob = null;
  }

  applyToJob(job: JobListing): void {
    if (!confirm(`Apply to ${job.title} at ${job.company}?`)) {
      return;
    }

    this.error = '';
    this.success = '';
    this.loading = true;

    // Show appropriate message based on headless mode
    if (this.headless) {
      this.statusMessage = `Restarting browser in visible mode and applying to ${job.title}...`;
    } else {
      this.statusMessage = `Applying to ${job.title}...`;
    }

    this.api.applyToJob(job.id).subscribe({
      next: (res) => {
        if (res.ok) {
          this.success = res.message || 'Application initiated successfully. Complete the application in the visible browser window.';
          this.statusMessage = 'Application initiated';
          // Automatically turn off headless mode in the UI
          this.headless = false;
          // Add to applied jobs list
          if (!this.appliedJobs.find(j => j.id === job.id)) {
            this.appliedJobs.push(job);
          }
        } else {
          this.error = res.message || 'Failed to apply';
          this.statusMessage = 'Application failed';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to apply to job';
        this.statusMessage = 'Application failed';
        this.loading = false;
      },
    });
  }
}
