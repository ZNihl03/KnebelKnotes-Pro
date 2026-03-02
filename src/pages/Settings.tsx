import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const Settings = () => {
  const { user, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
    setUsername(user.user_metadata?.username ?? "");
  }, [user]);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        name: fullName.trim(),
        username: username.trim(),
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email ?? null,
        username: username.trim(),
        full_name: fullName.trim(),
      });
      if (profileError) {
        toast.error(profileError.message);
        setSavingProfile(false);
        return;
      }
      toast.success("Profile updated.");
    }
    setSavingProfile(false);
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      toast.error("Enter a new password.");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated.");
      setPassword("");
    }
    setSavingPassword(false);
  };

  return (
    <Layout>
      <section className="container py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">Account Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Update your name, username, and password.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading account...</div>
        ) : !user ? (
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Log in required</CardTitle>
              <CardDescription>Log in on the dedicated login page to access account settings.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild>
                <Link to="/login">Go to login</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <form onSubmit={handleProfileSave}>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Update your display name and username.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Dr. Jane Doe"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="jane.doe"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user.email ?? ""} readOnly disabled />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save profile"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <form onSubmit={handlePasswordSave}>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>Set a new account password.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="********"
                      autoComplete="new-password"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? "Updating..." : "Update password"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Settings;
