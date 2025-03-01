using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;

namespace Dos.Common
{
    using System;
    using System.Net;
    using System.Net.Mail;
    using System.Text;
    /// <summary>
    /// 邮件发送帮助类
    /// </summary>
    public class EmailHelper
    {
        private const string tab = "\t";
        /// <summary>
        /// 发送邮件。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public static bool Send(EmailParam param)
        {
            var message = new MailMessage();
            message.From = new MailAddress(param.FromAddress, param.DisplayName, param.BodyEncoding ?? Encoding.UTF8);
            if (!param.ToAddress.DosIsNullOrWhiteSpace())
            {
                message.To.Add(param.ToAddress);
            }
            else if (param.ToAddressList != null && param.ToAddressList.Any())
            {
                foreach (var mail in param.ToAddressList)
                {
                    message.To.Add(mail);
                }
            }
            message.Subject = param.Subject;
            message.Body = param.Body;
            message.IsBodyHtml = param.IsBodyHtml;
            message.Priority = MailPriority.High;
            message.BodyEncoding = param.BodyEncoding ?? Encoding.UTF8;
            if ((param.Attachment != null) && (param.Attachment.Any()))
            {
                foreach (Attachment attachment in param.Attachment)
                {
                    message.Attachments.Add(attachment);
                }
            }
            SmtpClient client = new SmtpClient
            {
                Host = param.Host,
                Port = param.Port
            };
            client.Credentials = param.IsUnnormal ? new NetworkCredential("", param.FromAddress + "\t" + param.Password) : new NetworkCredential(param.FromAddress, param.Password);
            client.EnableSsl = param.EnableSsl;
            if (!param.IsAsync)
            {
                try
                {
                    client.Send(message);
                }
                catch
                {
                    return false;
                }
                return true;
            }
            else
            {
                //此方法有问题。
                //client.SendAsync(message, null);
                try
                {
                    client.Send(message);
                }
                catch
                {
                    return false;
                }
                return true;
            }
        }
    }
}

