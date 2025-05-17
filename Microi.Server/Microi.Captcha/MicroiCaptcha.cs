using System;
using System.Threading.Tasks;
using Lazy.Captcha.Core;
using Lazy.Captcha.Core.Generator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Protocols;
using Dos.Common;
using Lazy.Captcha.Core.Generator.Image.Option;
using Newtonsoft.Json;

namespace Microi.net
{
    public class MicroiCaptchaContent : BaseParam
    {
        // public string Id { get; set; }

        public string Code { get; set; }

        public byte[] Bytes { get; set; }

        public string Base64
        {
            get
            {
                if (Bytes == null)
                {
                    return null;
                }
                return Convert.ToBase64String(Bytes);
            }
        }
    }

    /// <summary>
    /// 
    /// </summary>
    public class MicroiCaptcha : ICaptcha //IMicroiCaptcha
    {
        private readonly ICaptcha _captcha;

        /// <summary>
        /// 
        /// </summary>
        /// <param name="captchaId"></param>
        /// <param name="expirySeconds"></param>
        /// <returns></returns>
        public DosResult<MicroiCaptchaContent> Generate(string captchaId, int? expirySeconds = null)
        {
            try
            {
                var result = _captcha.Generate(captchaId, expirySeconds);
                var data = new MicroiCaptchaContent() {
                    Id = result.Id,
                    Code = result.Code,
                    Bytes = result.Bytes
                };
                return new DosResult<MicroiCaptchaContent>(0, data);
            }
            catch (Exception ex)
            {
                return new DosResult<MicroiCaptchaContent>(0, null, ex.Message) ;
            }
        }

        public bool Validate(string captchaId, string code, bool removeIfSuccess = true, bool removeIfFail = true)
        {
            throw new NotImplementedException();
        }

        CaptchaData ICaptcha.Generate(string captchaId, int? expirySeconds)
        {
            throw new NotImplementedException();
        }
    }
    /// <summary>
    /// 
    /// </summary>
    public static class MicroiCaptchaExtensions
    {
        public static IServiceCollection AddMicroiCaptcha(this IServiceCollection services, OsClientSecret osclientModel = null)
        {
            try
            {
                var optionDefault = new CaptchaOptions() {
                    CaptchaType = CaptchaType.ARITHMETIC_ZH,// 验证码类型
                    ExpirySeconds = 60 * 5,// 验证码过期时间
                    ImageOption = new CaptchaImageGeneratorOption() {
                        Animation = true // 是否启用动画
                    }
                };
                if (osclientModel != null)
                {
                    try
                    {
                        var sysConfig = osclientModel.DbRead.FromSql("select * from sys_config where IsEnable=1 and IsDeleted=0").ToFirst<dynamic>();
                        if (sysConfig != null)
                        {
                            var captchaConfig = (string)sysConfig.CaptchaConfig;
                            if (!captchaConfig.DosIsNullOrWhiteSpace())
                            {
                                var optionConfig = JsonConvert.DeserializeObject<CaptchaOptions>(captchaConfig);
                                if (optionConfig != null)
                                {
                                    optionDefault = optionConfig;
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        
                    }
                }
                //services.AddSingleton<IMicroiCaptcha, MicroiCaptcha>();
                //builder.Configuration
                services.AddCaptcha(option =>
                {
                    //无效
                    //option = optionDefault;
                    option.CaptchaType = optionDefault.CaptchaType;
                    option.CodeLength = optionDefault.CodeLength;
                    option.ExpirySeconds = optionDefault.ExpirySeconds;
                    option.IgnoreCase = optionDefault.IgnoreCase;
                    if (!optionDefault.StoreageKeyPrefix.DosIsNullOrWhiteSpace())
                        option.StoreageKeyPrefix = optionDefault.StoreageKeyPrefix;

                    option.ImageOption.Animation = optionDefault.ImageOption.Animation;
                    option.ImageOption.FrameDelay = optionDefault.ImageOption.FrameDelay;
                    option.ImageOption.Width = optionDefault.ImageOption.Width;
                    option.ImageOption.Height = optionDefault.ImageOption.Height;
                    option.ImageOption.BackgroundColor = optionDefault.ImageOption.BackgroundColor;
                    option.ImageOption.BubbleCount = optionDefault.ImageOption.BubbleCount;
                    option.ImageOption.BubbleMinRadius = optionDefault.ImageOption.BubbleMinRadius;
                    option.ImageOption.BubbleMaxRadius = optionDefault.ImageOption.BubbleMaxRadius;
                    option.ImageOption.BubbleThickness = optionDefault.ImageOption.BubbleThickness;
                    option.ImageOption.InterferenceLineCount = optionDefault.ImageOption.InterferenceLineCount;
                    option.ImageOption.FontSize = optionDefault.ImageOption.FontSize;
                    option.ImageOption.FontFamily = optionDefault.ImageOption.FontFamily;
                    option.ImageOption.TextBold = optionDefault.ImageOption.TextBold;
                    if (optionDefault.ImageOption.ForegroundColors != null)
                        option.ImageOption.ForegroundColors = optionDefault.ImageOption.ForegroundColors;
                    option.ImageOption.Quality = optionDefault.ImageOption.Quality;


                    //option.CaptchaType = CaptchaType.ARITHMETIC_ZH; // 验证码类型
                    ////option.CodeLength = 6; // 验证码长度, 要放在CaptchaType设置后.  当类型为算术表达式时，长度代表操作的个数
                    //option.ExpirySeconds = 60 * 5; // 验证码过期时间
                    ////option.IgnoreCase = true; // 比较时是否忽略大小写
                    ////option.StoreageKeyPrefix = ""; // 存储键前缀

                    //option.ImageOption.Animation = true; // 是否启用动画
                    ////option.ImageOption.FrameDelay = 30; // 每帧延迟,Animation=true时有效, 默认30

                    ////option.ImageOption.Width = 150; // 验证码宽度
                    ////option.ImageOption.Height = 50; // 验证码高度
                    ////option.ImageOption.BackgroundColor = SixLabors.ImageSharp.Color.White; // 验证码背景色

                    ////option.ImageOption.BubbleCount = 2; // 气泡数量
                    ////option.ImageOption.BubbleMinRadius = 5; // 气泡最小半径
                    ////option.ImageOption.BubbleMaxRadius = 15; // 气泡最大半径
                    ////option.ImageOption.BubbleThickness = 1; // 气泡边沿厚度

                    ////option.ImageOption.InterferenceLineCount = 2; // 干扰线数量

                    ////option.ImageOption.FontSize = 36; // 字体大小
                    ////option.ImageOption.FontFamily = DefaultFontFamilys.Instance.Actionj; // 字体

                    /////* 
                    //// * 中文使用kaiti，其他字符可根据喜好设置（可能部分转字符会出现绘制不出的情况）。
                    //// * 当验证码类型为“ARITHMETIC”时，不要使用“Ransom”字体。（运算符和等号绘制不出来）
                    //// */

                    ////option.ImageOption.TextBold = true;// 粗体，该配置2.0.3新增
                });
                Console.WriteLine("Microi：注入验证码插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：注入验证码插件失败：" + ex.Message);
                return services;
            }
            
        }
    }
    
}

