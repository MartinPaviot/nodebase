import prisma from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  // Get embed config
  const embed = await prisma.agentEmbed.findUnique({
    where: { agentId },
    include: {
      agent: {
        select: { name: true, avatar: true },
      },
    },
  });

  if (!embed || !embed.enabled) {
    return new Response("// Embed not configured or disabled", {
      status: 200,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Check domain if restrictions are set
  const origin =
    request.headers.get("origin") || request.headers.get("referer");
  if (embed.allowedDomains.length > 0 && origin) {
    try {
      const originHost = new URL(origin).hostname;
      const isAllowed = (embed.allowedDomains as string[]).some(
        (domain) => originHost === domain || originHost.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return new Response("// Domain not allowed", {
          status: 200,
          headers: { "Content-Type": "application/javascript" },
        });
      }
    } catch {
      // Invalid URL
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nodebase.app";

  // Build config with all customization options
  const config = {
    agentId,
    displayName: embed.displayName || embed.agent.name,
    welcomeMessage:
      embed.welcomeMessage || `Hi! I'm ${embed.agent.name}. How can I help you?`,
    logo: embed.logo || embed.agent.avatar,
    conversationStarters: embed.conversationStarters,
    apiUrl: `${baseUrl}/api/agents/embed/chat`,
    // Colors
    accentColor: embed.accentColor,
    backgroundColor: embed.backgroundColor,
    textColor: embed.textColor,
    userBubbleColor: embed.userBubbleColor,
    botBubbleColor: embed.botBubbleColor,
    // Position & Size
    position: embed.position,
    buttonSize: embed.buttonSize,
    windowWidth: embed.windowWidth,
    windowHeight: embed.windowHeight,
    // Behavior
    autoOpen: embed.autoOpen,
    autoOpenDelay: embed.autoOpenDelay,
    showBranding: embed.showBranding,
    collectEmail: embed.collectEmail,
    requireEmail: embed.requireEmail,
    // Custom CSS
    customCss: embed.customCss || "",
  };

  // Position styles helper
  const getPositionStyles = (position: string) => {
    switch (position) {
      case "BOTTOM_LEFT":
        return "bottom: 20px; left: 20px;";
      case "TOP_RIGHT":
        return "top: 20px; right: 20px;";
      case "TOP_LEFT":
        return "top: 20px; left: 20px;";
      default: // BOTTOM_RIGHT
        return "bottom: 20px; right: 20px;";
    }
  };

  const getWindowPositionStyles = (position: string, buttonSize: number) => {
    const offset = buttonSize + 10;
    switch (position) {
      case "BOTTOM_LEFT":
        return `bottom: ${offset}px; left: 0;`;
      case "TOP_RIGHT":
        return `top: ${offset}px; right: 0;`;
      case "TOP_LEFT":
        return `top: ${offset}px; left: 0;`;
      default: // BOTTOM_RIGHT
        return `bottom: ${offset}px; right: 0;`;
    }
  };

  // Generate the embed widget JavaScript
  const script = `
(function() {
  var CONFIG = ${JSON.stringify(config)};

  // Styles
  var styles = \`
    .nodebase-chat {
      position: fixed;
      ${getPositionStyles(embed.position)}
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .nb-chat-button {
      width: \${CONFIG.buttonSize}px;
      height: \${CONFIG.buttonSize}px;
      border-radius: 50%;
      background: \${CONFIG.accentColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .nb-chat-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .nb-chat-button svg {
      width: \${Math.floor(CONFIG.buttonSize * 0.45)}px;
      height: \${Math.floor(CONFIG.buttonSize * 0.45)}px;
      fill: white;
    }
    .nb-chat-window {
      position: absolute;
      ${getWindowPositionStyles(embed.position, embed.buttonSize)}
      width: \${CONFIG.windowWidth}px;
      height: \${CONFIG.windowHeight}px;
      background: \${CONFIG.backgroundColor};
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .nb-chat-window.open {
      display: flex;
    }
    .nb-chat-header {
      padding: 16px;
      background: \${CONFIG.accentColor};
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .nb-chat-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .nb-chat-avatar img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    .nb-chat-title {
      font-weight: 600;
      font-size: 16px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nb-chat-close {
      margin-left: auto;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      font-size: 18px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    .nb-chat-close:hover {
      opacity: 1;
    }
    .nb-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: \${CONFIG.backgroundColor};
    }
    .nb-message {
      margin-bottom: 12px;
      max-width: 85%;
    }
    .nb-message.user {
      margin-left: auto;
    }
    .nb-message-content {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .nb-message.assistant .nb-message-content {
      background: \${CONFIG.botBubbleColor};
      color: \${CONFIG.textColor};
    }
    .nb-message.user .nb-message-content {
      background: \${CONFIG.userBubbleColor};
      color: white;
    }
    .nb-chat-starters {
      padding: 0 16px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: \${CONFIG.backgroundColor};
    }
    .nb-starter {
      padding: 8px 12px;
      background: \${CONFIG.backgroundColor};
      border: 1px solid \${CONFIG.botBubbleColor};
      border-radius: 16px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      color: \${CONFIG.textColor};
    }
    .nb-starter:hover {
      background: \${CONFIG.botBubbleColor};
    }
    .nb-chat-input {
      padding: 12px 16px;
      border-top: 1px solid \${CONFIG.botBubbleColor};
      display: flex;
      gap: 8px;
      background: \${CONFIG.backgroundColor};
    }
    .nb-chat-input input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid \${CONFIG.botBubbleColor};
      border-radius: 20px;
      font-size: 14px;
      outline: none;
      background: \${CONFIG.backgroundColor};
      color: \${CONFIG.textColor};
    }
    .nb-chat-input input:focus {
      border-color: \${CONFIG.accentColor};
    }
    .nb-chat-input input::placeholder {
      color: \${CONFIG.textColor};
      opacity: 0.5;
    }
    .nb-chat-input button {
      padding: 10px 16px;
      background: \${CONFIG.accentColor};
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .nb-chat-input button:hover {
      opacity: 0.9;
    }
    .nb-chat-input button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .nb-typing {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
    }
    .nb-typing span {
      width: 8px;
      height: 8px;
      background: \${CONFIG.textColor};
      opacity: 0.5;
      border-radius: 50%;
      animation: nbBounce 1.4s infinite ease-in-out both;
    }
    .nb-typing span:nth-child(1) { animation-delay: -0.32s; }
    .nb-typing span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes nbBounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    .nb-branding {
      padding: 8px;
      text-align: center;
      font-size: 11px;
      color: \${CONFIG.textColor};
      opacity: 0.5;
      background: \${CONFIG.backgroundColor};
    }
    .nb-branding a {
      color: inherit;
      text-decoration: none;
    }
    .nb-branding a:hover {
      text-decoration: underline;
    }
    .nb-email-form {
      padding: 24px;
      background: \${CONFIG.backgroundColor};
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .nb-email-form h3 {
      font-size: 18px;
      font-weight: 600;
      color: \${CONFIG.textColor};
      margin: 0;
    }
    .nb-email-form p {
      font-size: 14px;
      color: \${CONFIG.textColor};
      opacity: 0.7;
      margin: 0;
    }
    .nb-email-form input {
      padding: 12px 16px;
      border: 1px solid \${CONFIG.botBubbleColor};
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      background: \${CONFIG.backgroundColor};
      color: \${CONFIG.textColor};
    }
    .nb-email-form input:focus {
      border-color: \${CONFIG.accentColor};
    }
    .nb-email-form button {
      padding: 12px 16px;
      background: \${CONFIG.accentColor};
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
    }
    .nb-email-form .nb-skip {
      background: transparent;
      color: \${CONFIG.textColor};
      opacity: 0.7;
    }
    .nb-email-form .nb-skip:hover {
      opacity: 1;
    }
    \${CONFIG.customCss}
  \`;

  // Create widget
  var widget = document.createElement('div');
  widget.className = 'nodebase-chat';

  var starters = Array.isArray(CONFIG.conversationStarters) ? CONFIG.conversationStarters : [];
  var showEmailForm = CONFIG.collectEmail;
  var userEmail = null;

  function renderChat() {
    widget.innerHTML = \`
      <style>\${styles}</style>
      <button class="nb-chat-button" aria-label="Open chat">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
      <div class="nb-chat-window">
        <div class="nb-chat-header">
          <div class="nb-chat-avatar">
            \${CONFIG.logo ? '<img src="' + CONFIG.logo + '" alt="">' : '<svg viewBox="0 0 24 24" fill="white" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>'}
          </div>
          <span class="nb-chat-title">\${CONFIG.displayName}</span>
          <button class="nb-chat-close" aria-label="Close">&#x2715;</button>
        </div>
        \${showEmailForm ? \`
          <div class="nb-email-form">
            <h3>Welcome!</h3>
            <p>Please enter your email to start chatting\${CONFIG.requireEmail ? '' : ' (optional)'}.</p>
            <input type="email" placeholder="your@email.com" class="nb-email-input" />
            <button class="nb-email-submit">Start Chat</button>
            \${!CONFIG.requireEmail ? '<button class="nb-skip">Skip</button>' : ''}
          </div>
        \` : \`
          <div class="nb-chat-messages">
            <div class="nb-message assistant">
              <div class="nb-message-content">\${CONFIG.welcomeMessage}</div>
            </div>
          </div>
          \${starters.length > 0 ? '<div class="nb-chat-starters">' + starters.map(function(s) { return '<button class="nb-starter">' + escapeHtml(s) + '</button>'; }).join('') + '</div>' : ''}
          <div class="nb-chat-input">
            <input type="text" placeholder="Type a message..." />
            <button type="submit">Send</button>
          </div>
        \`}
        \${CONFIG.showBranding ? '<div class="nb-branding"><a href="https://nodebase.app" target="_blank" rel="noopener">Powered by Nodebase</a></div>' : ''}
      </div>
    \`;
    attachEventListeners();
  }

  function renderChatAfterEmail() {
    showEmailForm = false;
    var windowEl = widget.querySelector('.nb-chat-window');
    if (windowEl) {
      var emailForm = windowEl.querySelector('.nb-email-form');
      if (emailForm) {
        emailForm.outerHTML = \`
          <div class="nb-chat-messages">
            <div class="nb-message assistant">
              <div class="nb-message-content">\${CONFIG.welcomeMessage}</div>
            </div>
          </div>
          \${starters.length > 0 ? '<div class="nb-chat-starters">' + starters.map(function(s) { return '<button class="nb-starter">' + escapeHtml(s) + '</button>'; }).join('') + '</div>' : ''}
          <div class="nb-chat-input">
            <input type="text" placeholder="Type a message..." />
            <button type="submit">Send</button>
          </div>
        \`;
        attachChatListeners();
      }
    }
  }

  renderChat();
  document.body.appendChild(widget);

  // State
  var conversationId = null;
  var isLoading = false;

  function attachEventListeners() {
    var chatButton = widget.querySelector('.nb-chat-button');
    var chatWindow = widget.querySelector('.nb-chat-window');
    var closeButton = widget.querySelector('.nb-chat-close');

    // Toggle chat
    if (chatButton) {
      chatButton.addEventListener('click', function() {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open') && !showEmailForm) {
          var input = widget.querySelector('.nb-chat-input input');
          if (input) input.focus();
        }
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', function() {
        chatWindow.classList.remove('open');
      });
    }

    // Email form listeners
    var emailSubmit = widget.querySelector('.nb-email-submit');
    var emailSkip = widget.querySelector('.nb-skip');
    var emailInput = widget.querySelector('.nb-email-input');

    if (emailSubmit) {
      emailSubmit.addEventListener('click', function() {
        if (emailInput) {
          userEmail = emailInput.value;
          if (CONFIG.requireEmail && !userEmail) {
            emailInput.style.borderColor = 'red';
            return;
          }
        }
        renderChatAfterEmail();
      });
    }

    if (emailSkip) {
      emailSkip.addEventListener('click', function() {
        renderChatAfterEmail();
      });
    }

    if (emailInput) {
      emailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          userEmail = emailInput.value;
          if (CONFIG.requireEmail && !userEmail) {
            emailInput.style.borderColor = 'red';
            return;
          }
          renderChatAfterEmail();
        }
      });
    }

    // Chat listeners if not showing email form
    if (!showEmailForm) {
      attachChatListeners();
    }

    // Auto open
    if (CONFIG.autoOpen) {
      setTimeout(function() {
        chatWindow.classList.add('open');
      }, CONFIG.autoOpenDelay * 1000);
    }
  }

  function attachChatListeners() {
    var messagesContainer = widget.querySelector('.nb-chat-messages');
    var input = widget.querySelector('.nb-chat-input input');
    var sendButton = widget.querySelector('.nb-chat-input button');
    var starterButtons = widget.querySelectorAll('.nb-starter');

    if (sendButton) {
      sendButton.addEventListener('click', function() { sendMessage(input.value); });
    }

    if (input) {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage(input.value);
      });
    }

    if (starterButtons) {
      starterButtons.forEach(function(s) {
        s.addEventListener('click', function() { sendMessage(s.textContent); });
      });
    }
  }

  // Send message
  function sendMessage(text) {
    if (!text || !text.trim() || isLoading) return;

    var messagesContainer = widget.querySelector('.nb-chat-messages');
    var input = widget.querySelector('.nb-chat-input input');
    var sendButton = widget.querySelector('.nb-chat-input button');

    isLoading = true;
    if (sendButton) sendButton.disabled = true;
    if (input) input.value = '';

    // Add user message
    addMessage(text, 'user');

    // Show typing indicator
    var typing = document.createElement('div');
    typing.className = 'nb-message assistant';
    typing.innerHTML = '<div class="nb-typing"><span></span><span></span><span></span></div>';
    if (messagesContainer) {
      messagesContainer.appendChild(typing);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Hide starters
    var startersContainer = widget.querySelector('.nb-chat-starters');
    if (startersContainer) startersContainer.style.display = 'none';

    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: CONFIG.agentId,
        conversationId: conversationId,
        message: text,
        email: userEmail,
      }),
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      conversationId = data.conversationId;
      if (typing.parentNode) typing.remove();
      addMessage(data.response, 'assistant');
    })
    .catch(function() {
      if (typing.parentNode) typing.remove();
      addMessage('Sorry, something went wrong. Please try again.', 'assistant');
    })
    .finally(function() {
      isLoading = false;
      if (sendButton) sendButton.disabled = false;
    });
  }

  function addMessage(text, role) {
    var messagesContainer = widget.querySelector('.nb-chat-messages');
    if (!messagesContainer) return;
    var msg = document.createElement('div');
    msg.className = 'nb-message ' + role;
    msg.innerHTML = '<div class="nb-message-content">' + escapeHtml(text) + '</div>';
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
`;

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
