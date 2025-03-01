using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Dos.Common
{
    public class EnumHelper
    {
        public enum HttpParamType
        {
            
            /// <summary>
            /// 形如：key=value＆key=value＆key=value
            /// </summary>
            Form,
            /// <summary>
            /// json数据。
            /// </summary>
            Json
        }
        /// <summary>
        /// 生成缩略图的模式， WH-指定宽高缩放（可能变形） W-指定宽，高按比例  H-指定高，宽按比例 CUT-指定高宽裁减。
        /// </summary>
        public enum ImageMode : byte
        {
            /// <summary>
            /// 指定宽高缩放（可能变形）
            /// </summary>
            WH,
            /// <summary>
            /// 指定宽，高按比例
            /// </summary>
            W,
            /// <summary>
            /// 指定高，宽按比例
            /// </summary>
            H,
            /// <summary>
            /// 指定高宽裁减
            /// </summary>
            CUT
        }
        /// <summary>
        /// 加图片水印的位置，TopLeft-左上角 TopCenter-上中间 TopRight-右上角 BottomLeft-左下角 BottomCenter-下中间 右下角-右下角 Middle-正中间。
        /// </summary>
        public enum ImageWaterPosition : byte
        {
            /// <summary>
            /// 左上角
            /// </summary>
            LeftTop,
            /// <summary>
            /// 上中间
            /// </summary>
            CenterTop,
            /// <summary>
            /// 右上角
            /// </summary>
            RightTop,
            /// <summary>
            /// 左下角
            /// </summary>
            LeftBottom,
            /// <summary>
            /// 下中间
            /// </summary>
            CenterBottom,
            /// <summary>
            /// 右下角
            /// </summary>
            RightBottom,
            /// <summary>
            /// 正中间
            /// </summary>
            Middle
        }
    }
}
