
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "./app.js";

describe("CourtPulse API integration tests", () => {
  it("returns a healthy API response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      application: "CourtPulse",
      message: "CourtPulse API is running",
    });
  });

  it("returns JSON for an unknown endpoint", async () => {
    const response = await request(app).get("/api/not-a-real-route");

    expect(response.status).toBe(404);
  });
});
