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
    public class MicroiCaptcha : ICaptcha
    {
        private readonly ICaptcha _captcha;

        /// <summary>
        /// 构造函数，通过依赖注入获取 ICaptcha 实例
        /// </summary>
        /// <param name="captcha">由 Lazy.Captcha 库提供的 ICaptcha 实现</param>
        public MicroiCaptcha(ICaptcha captcha)
        {
            _captcha = captcha ?? throw new ArgumentNullException(nameof(captcha));
        }

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
                var data = new MicroiCaptchaContent()
                {
                    Id = result.Id,
                    Code = result.Code,
                    Bytes = result.Bytes
                };
                return new DosResult<MicroiCaptchaContent>(0, data);
            }
            catch (Exception ex)
            {
                return new DosResult<MicroiCaptchaContent>(0, null, ex.Message);
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
                var optionDefault = new CaptchaOptions()
                {
                    CaptchaType = CaptchaType.ARITHMETIC_ZH,// 验证码类型
                    CodeLength = 1,// 验证码长度, 要放在CaptchaType设置后.  当类型为算术表达式时，长度代表操作的个数
                    ExpirySeconds = 60 * 5,// 验证码过期时间
                    IgnoreCase = true,// 比较时是否忽略大小写
                    ImageOption = new CaptchaImageGeneratorOption()
                    {
                        Animation = true, // 是否启用动画
                        FontSize = 32,// 字体大小
                        Width = 150,// 验证码宽度
                        Height = 50,// 验证码高度
                        BubbleMinRadius = 5, // 气泡最小半径
                        BubbleMaxRadius = 10,// 气泡最大半径
                        BubbleCount = 1,// 气泡数量
                        BubbleThickness = 1.0F,// 气泡边沿厚度
                        InterferenceLineCount = 1,// 干扰线数量
                        FrameDelay = 300,// 每帧延迟,Animation=true时有效, 默认30
                        Quality = 100,// 图片质量（质量越高图片越大，gif调整无效可能会更大）
                        TextBold = false,// 粗体，该配置2.0.3新增
                    }
                };
                if (osclientModel != null)
                {
                    try
                    {
                        var sysConfig = osclientModel.DbRead.FromSql("select * from sys_config where IsEnable=1 and IsDeleted <> 1").ToFirst<dynamic>();
                        if (sysConfig != null)
                        {
                            var captchaConfig = (string)sysConfig.CaptchaConfig;
                            if (!captchaConfig.DosIsNullOrWhiteSpace())
                            {
                                var optionConfig = JsonHelper.Deserialize<CaptchaOptions>(captchaConfig);
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
                services.AddCaptcha(option =>
                {
                    option.CaptchaType = optionDefault.CaptchaType;
                    option.CodeLength = optionDefault.CodeLength;
                    option.ExpirySeconds = optionDefault.ExpirySeconds;
                    option.IgnoreCase = optionDefault.IgnoreCase;
                    if (!optionDefault.StoreageKeyPrefix.DosIsNullOrWhiteSpace())
                        option.StoreageKeyPrefix = optionDefault.StoreageKeyPrefix;// 存储键前缀

                    option.ImageOption.Animation = optionDefault.ImageOption.Animation;// 是否启用动画
                    option.ImageOption.FrameDelay = optionDefault.ImageOption.FrameDelay;
                    option.ImageOption.Width = optionDefault.ImageOption.Width;
                    option.ImageOption.Height = optionDefault.ImageOption.Height;
                    option.ImageOption.BackgroundColor = optionDefault.ImageOption.BackgroundColor;// 验证码背景色 SixLabors.ImageSharp.Color.White; 
                    option.ImageOption.BubbleCount = optionDefault.ImageOption.BubbleCount;
                    option.ImageOption.BubbleMinRadius = optionDefault.ImageOption.BubbleMinRadius;
                    option.ImageOption.BubbleMaxRadius = optionDefault.ImageOption.BubbleMaxRadius;
                    option.ImageOption.BubbleThickness = optionDefault.ImageOption.BubbleThickness;
                    option.ImageOption.InterferenceLineCount = optionDefault.ImageOption.InterferenceLineCount;
                    option.ImageOption.FontSize = optionDefault.ImageOption.FontSize;
                    option.ImageOption.FontFamily = optionDefault.ImageOption.FontFamily;// 字体 DefaultFontFamilys.Instance.Actionj; 
                    option.ImageOption.TextBold = optionDefault.ImageOption.TextBold;
                    if (optionDefault.ImageOption.ForegroundColors != null)
                        option.ImageOption.ForegroundColors = optionDefault.ImageOption.ForegroundColors;
                    option.ImageOption.Quality = optionDefault.ImageOption.Quality;
                });
                Console.WriteLine("Microi：【成功】注入并初始化【验证码】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入并初始化【验证码】插件失败：" + ex.Message);
                return services;
            }

        }
    }

}

