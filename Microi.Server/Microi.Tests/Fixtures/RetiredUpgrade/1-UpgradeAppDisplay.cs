using System;
namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
	public class UpgradeAppDisplay
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "1.9.5.8";
        /// <summary>
        /// 
        /// </summary>
        public static string Sql = @"
    ALTER TABLE `Diy_Field` ADD COLUMN `AppVisible` int NULL COMMENT '移动端可见';
    ALTER TABLE `Sys_Menu` ADD COLUMN `AppDisplay` int NULL COMMENT '移动端显示';
    update diy_field set AppVisible=1 where AppVisible is null;
    update sys_menu set AppDisplay=1 where AppDisplay is null;
";
    }
}

