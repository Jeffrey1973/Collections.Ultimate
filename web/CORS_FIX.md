# CORS Configuration for .NET Backend

## Problem
The frontend (http://localhost:5173) cannot connect to the backend (http://localhost:5258) due to CORS (Cross-Origin Resource Sharing) restrictions.

## Solution

### For .NET 6+ Minimal API

Add this to your `Program.cs` **before** `var app = builder.Build();`:

```csharp
// Add CORS policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",  // Vite dev server
                "http://localhost:3000"   // Alternative port
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});
```

Then add this **after** `var app = builder.Build();` and **before** your endpoint mappings:

```csharp
// Use CORS
app.UseCors("AllowFrontend");
```

### For .NET 6+ with Controllers

In `Program.cs`:

```csharp
// Before builder.Build()
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// After var app = builder.Build()
app.UseCors();
```

### Full Example Program.cs

```csharp
var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ⭐ Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ⭐ Use CORS (must be before endpoints!)
app.UseCors("AllowFrontend");

// Your API endpoints here
app.MapPost("/api/households/{householdId}/library/books", async (/* params */) => 
{
    // ...
});

app.Run();
```

## Testing

1. Update your .NET backend with the CORS configuration above
2. Restart your backend
3. Open the test file: `test-api.html` in a browser
4. Click "Test POST ..." button
5. Check the output - should work without CORS errors

## Production Note

For production, replace:
```csharp
policy.WithOrigins("http://localhost:5173")
```

With your actual frontend domain:
```csharp
policy.WithOrigins("https://yourdomain.com")
```

Or use environment variables:
```csharp
var frontendUrl = builder.Configuration["FrontendUrl"] ?? "http://localhost:5173";
policy.WithOrigins(frontendUrl)
```
