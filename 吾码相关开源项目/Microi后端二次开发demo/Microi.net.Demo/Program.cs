using Microi.net;
using Dos.Common;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
var services = builder.Services;

//------- Microi.net初始化 START ---------
Console.WriteLine("Microi：开始初始化！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
Stopwatch timer = new Stopwatch();
timer.Start();
services.AddMicroi();
//------- Microi.net初始化 END ---------

// Add services to the container.
builder.Services.AddControllersWithViews();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

Console.WriteLine($"Microi：初始化成功！{DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}。耗时：{timer.ElapsedMilliseconds}ms");
timer.Stop();
app.Run();
