using Dos.ORM;

namespace Microi.net
{
    public partial class SysMenu
    {
        private string _MenuBadgeTooltip;

        /// <summary>
        /// 左侧菜单数字角标的悬停说明。
        /// </summary>
        [Field("MenuBadgeTooltip")]
        public string MenuBadgeTooltip
        {
            get => _MenuBadgeTooltip;
            set
            {
                OnPropertyValueChange("MenuBadgeTooltip");
                _MenuBadgeTooltip = value;
            }
        }
    }
}
