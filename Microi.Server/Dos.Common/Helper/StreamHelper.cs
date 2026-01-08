using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;

namespace Dos.Common
{
    /// <summary>
    /// 
    /// </summary>
    public class StreamHelper
    {
        /// <summary>
        /// 将 Stream 转换为 MemoryStream
        /// ⚠️ 注意：返回的 MemoryStream 需要调用方使用 using 或手动 Dispose
        /// </summary>
        /// <param name="instream"></param>
        /// <returns>需要手动释放的 MemoryStream</returns>
        public static MemoryStream StreamToMemoryStream(Stream instream)
        {
            //这段有一定的问题：new Bitmap(这段返回的对象).Save()报Parameter is not valid
            byte[] b = new byte[instream.Length];
            instream.Read(b, 0, b.Length);
            var ms = new MemoryStream();
            ms.Write(b, 0, b.Length);
            return ms;

            //var image = Image.FromStream(instream);
            //image.Save
            //Image bitmap = new Bitmap(instream);
            //var ms = new MemoryStream();
            //bitmap.Save(ms, image.RawFormat);

        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="stream"></param>
        /// <returns></returns>
        public static byte[] StreamToBytes(Stream stream)
        {
            byte[] bytes = new byte[stream.Length];
            // 设置当前流的位置为流的开始 
            stream.Seek(0, SeekOrigin.Begin);
            stream.Read(bytes, 0, bytes.Length);
            return bytes;
        }
        /// <summary>
        /// 将字节数组转换为 Stream
        /// ⚠️ 注意：返回的 Stream 需要调用方使用 using 或手动 Dispose
        /// </summary>
        /// <param name="bytes"></param>
        /// <returns>需要手动释放的 Stream</returns>
        public static Stream BytesToStream(byte[] bytes)
        {
            return new MemoryStream(bytes);
        }
    }
}
