import { connect } from "cloudflare:sockets";
import type { Env } from "./env";

export interface VerificationMail {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export interface Mailer {
  sendVerificationCode(message: VerificationMail): Promise<void>;
}

interface SmtpReply {
  code: number;
  lines: string[];
}

class SmtpConnection {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();
  private pending = "";

  constructor(private readonly socket: Socket) {
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  async reply(): Promise<SmtpReply> {
    const lines: string[] = [];
    let expectedCode: number | undefined;
    while (true) {
      const line = await this.line();
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!match) throw new Error("SMTP returned an invalid response.");
      const code = Number(match[1]);
      expectedCode ??= code;
      if (code !== expectedCode) throw new Error("SMTP returned inconsistent response codes.");
      lines.push(match[3] ?? "");
      if (match[2] === " ") return { code, lines };
    }
  }

  async command(value: string, expectedCodes: number[]): Promise<SmtpReply> {
    await this.writer.write(this.encoder.encode(value + "\r\n"));
    const reply = await this.reply();
    if (!expectedCodes.includes(reply.code)) {
      throw new Error("SMTP command failed with code " + reply.code + ".");
    }
    return reply;
  }

  async data(value: string): Promise<void> {
    await this.writer.write(this.encoder.encode(value + "\r\n.\r\n"));
    const reply = await this.reply();
    if (reply.code !== 250) throw new Error("SMTP message delivery was rejected with code " + reply.code + ".");
  }


  async close(): Promise<void> {
    this.reader.releaseLock();
    this.writer.releaseLock();
    await this.socket.close().catch(() => undefined);
  }

  private async line(): Promise<string> {
    while (!this.pending.includes("\n")) {
      const result = await this.reader.read();
      if (result.done) throw new Error("SMTP connection closed unexpectedly.");
      this.pending += this.decoder.decode(result.value, { stream: true });
    }
    const newlineIndex = this.pending.indexOf("\n");
    const line = this.pending.slice(0, newlineIndex).replace(/\r$/, "");
    this.pending = this.pending.slice(newlineIndex + 1);
    return line;
  }
}

export class NoopMailer implements Mailer {
  async sendVerificationCode(): Promise<void> {}
}

export class QqSmtpMailer implements Mailer {
  constructor(private readonly env: Env) {}

  async sendVerificationCode(message: VerificationMail): Promise<void> {
    const username = this.env.SMTP_USERNAME;
    const authorizationCode = this.env.SMTP_AUTHORIZATION_CODE;
    const from = this.env.SMTP_FROM ?? username;
    if (!username || !authorizationCode || !from) {
      throw new Error("QQ SMTP credentials are not configured.");
    }
    assertMailbox(username);
    assertMailbox(from);
    assertMailbox(message.to);

    const host = this.env.SMTP_HOST ?? "smtp.qq.com";
    const port = positivePort(this.env.SMTP_PORT, 465);
    const socket = connect(
      { hostname: host, port },
      { secureTransport: "on", allowHalfOpen: false },
    );
    const connection = new SmtpConnection(socket);
    try {
      await socket.opened;
      expectCode(await connection.reply(), [220]);
      await connection.command("EHLO tongkan.app", [250]);
      await connection.command("AUTH LOGIN", [334]);
      await connection.command(toBase64(username), [334]);
      await connection.command(toBase64(authorizationCode), [235]);
      await connection.command("MAIL FROM:<" + from + ">", [250]);
      await connection.command("RCPT TO:<" + message.to + ">", [250, 251]);
      await connection.command("DATA", [354]);
      await connection.data(buildMessage(this.env, from, message));
      await connection.command("QUIT", [221]);
    } finally {
      await connection.close();
    }
  }
}

function expectCode(reply: SmtpReply, expectedCodes: number[]): void {
  if (!expectedCodes.includes(reply.code)) throw new Error("SMTP connection failed with code " + reply.code + ".");
}

function positivePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function assertMailbox(value: string): void {
  if (!/^[^\s<>@]+@[^\s<>@]+$/.test(value) || /[\r\n]/.test(value)) {
    throw new Error("SMTP mailbox is invalid.");
  }
}

function toBase64(value: string): string {
  return btoa(value);
}

function encodedWord(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return "=?UTF-8?B?" + btoa(binary) + "?=";
}

function buildMessage(env: Env, from: string, message: VerificationMail): string {
  const fromName = env.SMTP_FROM_NAME ?? "同看";
  const subject = encodedWord("你的同看登录验证码");
  const body = [
    "你的同看登录验证码是：" + message.code,
    "",
    "验证码将在 " + message.expiresInMinutes + " 分钟后失效。",
    "如果不是你本人操作，请忽略这封邮件。",
  ].join("\r\n");
  return [
    "From: " + encodedWord(fromName) + " <" + from + ">",
    "To: <" + message.to + ">",
    "Subject: " + subject,
    "Date: " + new Date().toUTCString(),
    "Message-ID: <" + crypto.randomUUID() + "@tongkan.app>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(body),
  ].join("\r\n");
}

function dotStuff(value: string): string {
  return value.split("\r\n").map((line) => line.startsWith(".") ? "." + line : line).join("\r\n");
}
