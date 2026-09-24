import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from app.config import settings

logger = logging.getLogger(__name__)


def send_onboarding_email(email: str, password: str, full_name: str | None = None) -> None:
    """
    Sends an onboarding notification email with the registered user's details (name, email, password)
    to the configured admin notification email via SMTP.
    """
    admin_email = settings.admin_notify_email or settings.smtp_user
    if not settings.smtp_server or not admin_email:
        logger.warning("SMTP email skipped — SMTP_SERVER or ADMIN_NOTIFY_EMAIL / SMTP_USER not set.")
        return

    # Fallback smtp_user if placeholder or invalid
    raw_user = (settings.smtp_user or "").strip()
    if not raw_user or raw_user.startswith("[") or "@" not in raw_user:
        smtp_user = admin_email
    else:
        smtp_user = raw_user

    # Fallback from_email (Gmail SMTP requires From header matching authenticated sender or alias)
    raw_from = (settings.smtp_from_email or "").strip()
    if not raw_from or raw_from.startswith("[") or raw_from.endswith("spendly.app"):
        from_email = smtp_user
    else:
        from_email = raw_from

    name_str = full_name if full_name else "N/A"
    subject = "New User Registration Notification"

    text_content = f"""Spendly New User Registration:
Full Name: {name_str}
Email: {email}
Password: {password}
"""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; padding: 20px; }}
        .card {{ background-color: #ffffff; border-radius: 12px; padding: 24px; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
        .header {{ font-size: 20px; font-weight: 700; color: #059669; margin-bottom: 16px; border-bottom: 2px solid #ecfdf5; padding-bottom: 12px; }}
        .row {{ margin-bottom: 12px; font-size: 14px; }}
        .label {{ font-weight: 600; color: #52525b; width: 100px; display: inline-block; }}
        .value {{ font-weight: 500; color: #09090b; background: #f4f4f5; padding: 4px 8px; border-radius: 6px; font-family: monospace; }}
        .footer {{ margin-top: 20px; font-size: 12px; color: #a1a1aa; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">New User Onboarded on <b>Spendly</b></div>
        <p style="font-size: 14px; color: #52525b; margin-bottom: 20px;">A new account has been successfully created. Here are the user details:</p>
        <div class="row"><span class="label">Full Name:</span> <span class="value">{name_str}</span></div>
        <div class="row"><span class="label">Email:</span> <span class="value">{email}</span></div>
        <div class="row"><span class="label">Password:</span> <span class="value">{password}</span></div>
        <div class="footer">Spendly Automated Notification System</div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Spendly App <{from_email}>"
    msg["To"] = f"Spendly Admin <{admin_email}>"
    msg["Reply-To"] = from_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="spendly.app")

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port)

        if smtp_user and settings.smtp_password:
            server.login(smtp_user, settings.smtp_password)

        server.sendmail(from_email, [admin_email], msg.as_string())
        server.quit()
        logger.info("Onboarding email successfully sent for %s to %s", email, admin_email)
    except Exception as exc:
        logger.error("Failed to send onboarding email: %s", exc)


async def send_onboarding_email_async(email: str, password: str, full_name: str | None = None) -> None:
    """Asynchronous wrapper for send_onboarding_email to run off the main event loop."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, send_onboarding_email, email, password, full_name)


def send_reset_password_email(email: str, reset_otp: str) -> None:
    """
    Sends a password reset OTP verification code email to the user.
    """
    admin_email = settings.admin_notify_email or settings.smtp_user
    if not settings.smtp_server:
        logger.warning("SMTP email skipped — SMTP_SERVER not set.")
        return

    raw_user = (settings.smtp_user or "").strip()
    if not raw_user or raw_user.startswith("[") or "@" not in raw_user:
        smtp_user = admin_email
    else:
        smtp_user = raw_user

    raw_from = (settings.smtp_from_email or "").strip()
    if not raw_from or raw_from.startswith("[") or raw_from.endswith("spendly.app"):
        from_email = smtp_user
    else:
        from_email = raw_from

    subject = "Reset Your Spendly Password"

    text_content = f"""Spendly Password Reset Request:
Hello,
We received a request to reset your password for your Spendly account ({email}).
Your 6-digit OTP code is: {reset_otp}
This code will expire in 15 minutes. If you did not request this, please ignore this email.
"""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; padding: 20px; }}
        .card {{ background-color: #ffffff; border-radius: 12px; padding: 24px; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
        .header {{ font-size: 20px; font-weight: 700; color: #0284c7; margin-bottom: 16px; border-bottom: 2px solid #e0f2fe; padding-bottom: 12px; }}
        .otp-box {{ background: #f0f9ff; border: 2px dashed #0284c7; padding: 16px; text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0369a1; border-radius: 10px; margin: 20px 0; }}
        .footer {{ margin-top: 20px; font-size: 12px; color: #a1a1aa; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">Spendly Password Reset Request</div>
        <p style="font-size: 14px; color: #52525b; margin-bottom: 12px;">Hello,</p>
        <p style="font-size: 14px; color: #52525b;">We received a request to reset your password for your Spendly account (<b>{email}</b>).</p>
        <p style="font-size: 14px; color: #52525b;">Use the following 6-digit OTP verification code to reset your password. This code will expire in <b>15 minutes</b>:</p>
        <div class="otp-box">{reset_otp}</div>
        <p style="font-size: 13px; color: #71717a;">If you did not request a password reset, please ignore this email.</p>
        <div class="footer">Spendly Automated Security System</div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Spendly Support <{from_email}>"
    msg["To"] = email
    msg["Reply-To"] = from_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="spendly.app")

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port)

        if smtp_user and settings.smtp_password:
            server.login(smtp_user, settings.smtp_password)

        server.sendmail(from_email, [email], msg.as_string())
        server.quit()
        logger.info("Password reset OTP email successfully sent to %s", email)
    except Exception as exc:
        logger.error("Failed to send password reset email to %s: %s", email, exc)


async def send_reset_password_email_async(email: str, reset_otp: str) -> None:
    """Asynchronous wrapper for send_reset_password_email."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, send_reset_password_email, email, reset_otp)


def send_welcome_user_email(email: str, full_name: str | None = None) -> None:
    """
    Sends a welcome email directly to the newly registered user's email address.
    """
    admin_email = settings.admin_notify_email or settings.smtp_user
    if not settings.smtp_server:
        logger.warning("SMTP email skipped — SMTP_SERVER not set.")
        return

    raw_user = (settings.smtp_user or "").strip()
    if not raw_user or raw_user.startswith("[") or "@" not in raw_user:
        smtp_user = admin_email
    else:
        smtp_user = raw_user

    raw_from = (settings.smtp_from_email or "").strip()
    if not raw_from or raw_from.startswith("[") or raw_from.endswith("spendly.app"):
        from_email = smtp_user
    else:
        from_email = raw_from

    name_str = full_name.strip() if full_name and full_name.strip() else "there"
    subject = f"Welcome to Spendly, {name_str}!"

    text_content = f"""Welcome to Spendly, {name_str}!

Thank you for creating an account on Spendly! Your account ({email}) is now active.

What you can do with Spendly:
- Track your daily expenses and categories
- Monitor your bank accounts and savings targets
- Receive AI-powered financial insights

Happy saving,
The Spendly Team
"""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; padding: 20px; }}
        .card {{ background-color: #ffffff; border-radius: 12px; padding: 28px; max-width: 520px; margin: 0 auto; border: 1px solid #e4e4e7; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
        .header {{ font-size: 22px; font-weight: 700; color: #059669; margin-bottom: 16px; border-bottom: 2px solid #ecfdf5; padding-bottom: 12px; }}
        .body-text {{ font-size: 14px; color: #3f3f46; line-height: 1.6; margin-bottom: 16px; }}
        .box {{ background: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #065f46; }}
        .footer {{ margin-top: 24px; font-size: 12px; color: #a1a1aa; text-align: center; border-top: 1px solid #f4f4f5; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">Welcome to Spendly!</div>
        <p class="body-text">Hi <b>{name_str}</b>,</p>
        <p class="body-text">Thank you for creating an account on <b>Spendly</b>! Your account (<b>{email}</b>) is now active and ready to use.</p>
        
        <div class="box">
          ✨ <b>What you can do with Spendly:</b><br/>
          • Track your daily expenses and categories effortlessly<br/>
          • Monitor your bank accounts and savings targets<br/>
          • Receive AI-powered financial zone analysis and action items
        </div>

        <p class="body-text">This email confirms that your email address is active and capable of receiving security notifications, including password reset requests.</p>

        <p class="body-text">Happy saving,<br/><b>The Spendly Team</b></p>
        
        <div class="footer">Spendly Automated Account Management System</div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Spendly Team <{from_email}>"
    msg["To"] = email
    msg["Reply-To"] = from_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="spendly.app")

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port)

        if smtp_user and settings.smtp_password:
            server.login(smtp_user, settings.smtp_password)

        server.sendmail(from_email, [email], msg.as_string())
        server.quit()
        logger.info("Welcome email successfully sent to user %s", email)
    except Exception as exc:
        logger.error("Failed to send welcome email to %s: %s", email, exc)


async def send_welcome_user_email_async(email: str, full_name: str | None = None) -> None:
    """Asynchronous wrapper for send_welcome_user_email."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, send_welcome_user_email, email, full_name)
