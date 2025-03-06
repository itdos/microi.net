using System;

namespace Dos.Common
{
    /// <summary>
    /// 
    /// </summary>
    //[AttributeUsage(AttributeTargets.Field | AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
    public sealed class JsonProp : Attribute
    {
        /// <summary>
        /// Gets or sets the name of the property.
        /// </summary>
        /// <value>The name of the property.</value>
        public string PropertyName { get; set; }
        /// <summary>
        /// Initializes a new instance of the <see cref="JsonProp"/> class.
        /// </summary>
        public JsonProp()
        {
        }
        /// <summary>
        /// Initializes a new instance of the <see cref="JsonProp"/> class with the specified name.
        /// </summary>
        /// <param name="propertyName">Name of the property.</param>
        public JsonProp(string propertyName)
        {
            PropertyName = propertyName;
        }
    }
}