namespace Microi.net
{
    public partial class SysUserParam
    {
        // 只由可信 Login 校验成功后赋值；客户端 JSON、V8 与模型绑定均不可传入。
        [Newtonsoft.Json.JsonIgnore]
        internal PasswordAuthenticationSnapshot PasswordAuthentication { get; set; }
    }
}
