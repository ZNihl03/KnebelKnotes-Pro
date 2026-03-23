import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error("Enter your email or username and password.");
      return;
    }

    setBusy(true);
    const { error } = await signIn(identifier.trim(), password);
    setBusy(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Logged in.");
    setIdentifier("");
    setPassword("");
    navigate("/settings");
  };

  return (
    <Layout>
      <section className="container py-10 sm:py-12">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Log in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your Knebel Knotes account.
            </p>
          </div>

          {loading ? (
            <div className="text-center text-sm text-muted-foreground">Checking session...</div>
          ) : user ? (
            <Card>
              <CardHeader>
                <CardTitle>You are already logged in</CardTitle>
                <CardDescription>Manage your account or return to the homepage.</CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="secondary" className="w-full sm:w-auto">
                  <Link to="/settings">Account settings</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/">Go home</Link>
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <form onSubmit={handleLogin}>
                <CardHeader>
                  <CardTitle>Welcome back</CardTitle>
                  <CardDescription>Enter your credentials to continue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-identifier">Email or username</Label>
                    <Input
                      id="login-identifier"
                      type="text"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="you@example.com or username"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Logging in..." : "Log in"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Login;
