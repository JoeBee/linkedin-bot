import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BotApiService,
  BotState,
  ConversationSummary,
  RefreshDiagnostics,
} from './services/bot-api.service';

// Import credentials from local environment file
import { environmentLocal } from '../environments/environment.local';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  state: BotState = { status: 'idle', conversations: [] };
  email = environmentLocal.defaultEmail;
  password = environmentLocal.defaultPassword;
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
  statusMessage = 'Idle';  // Detailed status message
  activeTab: 'conversations' | 'jobs' | 'notifications' = 'conversations';

  constructor(private api: BotApiService) {
    this.pollStatus();
  }

  setActiveTab(tab: 'conversations' | 'jobs' | 'notifications'): void {
    this.activeTab = tab;
  }

  pollStatus(): void {
    this.api.getStatus().subscribe({
      next: (s) => (this.state = s),
      error: () => (this.state = { status: 'idle', conversations: [] }),
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

        // Auto-select and generate for Oksana Lysenko
        this.autoSelectOksana();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Refresh failed';
        this.statusMessage = 'Error loading conversations';
        this.loading = false;
      },
    });
  }

  private autoSelectOksana(): void {
    // Find Oksana's conversation (handle different spellings: Lysenko or Lynsesnko)
    const oksana = this.state.conversations.find(c => {
      const nameLower = c.name.toLowerCase();
      return nameLower.includes('oksana') && (nameLower.includes('lysenko') || nameLower.includes('lynsesnko'));
    });

    if (oksana) {
      console.log('[Auto-select] Found Oksana:', oksana.name);
      console.log('[Auto-select] Opening conversation to check if auto-generate is needed...');

      // Open the conversation
      this.error = '';
      this.success = '';
      this.loading = true;
      this.threadMessages = [];
      this.messageText = '';
      this.textareaRows = 3;
      this.statusMessage = `Loading messages from ${oksana.name}...`;

      this.api.openConversation(oksana.id).subscribe({
        next: (res) => {
          this.selectedConversation = oksana;
          this.threadMessages = (res.messages ?? []).map((m) =>
            typeof m === 'string' ? { text: m } : { text: m.text, timestamp: m.timestamp, fromMe: m.fromMe }
          );
          this.success = `Opened conversation with ${oksana.name}.`;
          this.statusMessage = `Conversation with ${oksana.name} - ${this.threadMessages.length} messages loaded`;
          this.loading = false;

          // Check if the most recent message is from Oksana (not from me)
          if (this.threadMessages.length > 0) {
            const mostRecentMessage = this.threadMessages[this.threadMessages.length - 1];
            const isFromOksana = !mostRecentMessage.fromMe;

            console.log('[Auto-select] Most recent message fromMe:', mostRecentMessage.fromMe);
            console.log('[Auto-select] Is from Oksana:', isFromOksana);

            if (isFromOksana) {
              console.log('[Auto-select] Most recent message is from Oksana - auto-generating AI reply...');
              this.success = `Opened conversation with ${oksana.name}. Auto-generating reply...`;

              // Small delay to ensure UI is updated
              setTimeout(() => {
                this.generateAiReply();
              }, 500);
            } else {
              console.log('[Auto-select] Most recent message is from me - skipping auto-generate');
              this.success = `Opened conversation with ${oksana.name}. Last message was from you.`;
            }
          }
        },
        error: (err) => {
          console.log('[Auto-select] Error opening conversation:', err);
          this.error = err?.error?.error || 'Failed to open';
          this.statusMessage = 'Error loading messages';
          this.loading = false;
        },
      });
    } else {
      console.log('[Auto-select] Oksana not found in conversations');
      console.log('[Auto-select] Available conversations:', this.state.conversations.map(c => c.name).join(', '));
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
        this.state = { status: 'idle', conversations: [] };
        this.selectedConversation = null;
        this.threadMessages = [];
        this.success = 'Logged out.';
        this.loading = false;
      },
      error: () => {
        this.state = { status: 'idle', conversations: [] };
        this.selectedConversation = null;
        this.threadMessages = [];
        this.loading = false;
      },
    });
  }

  generateAiReply(): void {
    console.log('[generateAiReply] Called! Selected:', this.selectedConversation?.name, 'Messages:', this.threadMessages.length);

    if (!this.selectedConversation) {
      console.log('[generateAiReply] ❌ No conversation selected');
      this.error = 'No conversation selected';
      return;
    }

    if (this.threadMessages.length === 0) {
      console.log('[generateAiReply] ❌ No messages to analyze');
      this.error = 'No messages to analyze';
      return;
    }

    console.log('[generateAiReply] ✅ Starting AI generation...');
    this.error = '';
    this.success = '';
    this.loading = true;
    this.statusMessage = `Generating AI reply for ${this.selectedConversation.name}...`;

    this.api.generateReply(
      this.threadMessages,
      this.selectedConversation.name
    ).subscribe({
      next: (res) => {
        console.log('[generateAiReply] ✅ AI reply received:', res.reply.substring(0, 50) + '...');
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
        console.log('[generateAiReply] ❌ Error:', err);
        this.error = err?.error?.error || 'Failed to generate AI reply';
        this.statusMessage = 'AI generation failed';
        this.loading = false;
      },
    });
  }
}
