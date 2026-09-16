using Microsoft.AspNetCore.Mvc;

namespace ContractWorkspace.DocumentService.Controllers;

/// <summary>
/// Liveness probe used by the dev/demo run scripts and the React client to
/// render the service-down banner state quickly.
/// </summary>
[ApiController]
[Route("health")]
public class HealthController(IWebHostEnvironment environment) : ControllerBase
{
    /// <summary>
    /// Health check returning the standard showcase probe shape:
    /// <c>{ "status": "Healthy", "timestamp": "&lt;utc-iso&gt;", "environment": "&lt;env&gt;", "version": "1.0.0" }</c>.
    /// </summary>
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "Healthy",
        timestamp = DateTime.UtcNow.ToString("o"),
        environment = environment.EnvironmentName,
        version = "1.0.0"
    });
}
