import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import ProfileImageUploader from "@/components/ProfileImageUploader";
import { useAuth } from "@/contexts/AuthContext";
import { useUiPreferences } from "@/contexts/UiPreferencesContext";
import { supabase } from "@/lib/supabaseClient";
import { createSubAdmin } from "@/lib/adminApi";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

type SubAdmin = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  profile_image_path: string | null;
  created_at: string | null;
};

const Settings = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { showCategoryIds, setShowCategoryIds } = useUiPreferences();
  const role = profile?.role;
  const isSuperAdmin = role === "super_admin";
  const isSubAdmin = role === "sub_admin";
  const isAdmin = isSuperAdmin || isSubAdmin;
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [subAdminLoading, setSubAdminLoading] = useState(false);
  const [subAdminError, setSubAdminError] = useState<string | null>(null);
  const [newSubAdmin, setNewSubAdmin] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
  });
  const [creatingSubAdmin, setCreatingSubAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
    setUsername(profile?.username ?? user.user_metadata?.username ?? "");
    setEmail(profile?.email ?? user.email ?? "");
  }, [user, profile]);

  const loadSubAdmins = useCallback(async () => {
    setSubAdminLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, username, profile_image_path, created_at")
      .eq("role", "sub_admin")
      .order("created_at", { ascending: false });

    if (error) {
      setSubAdminError(error.message);
      setSubAdmins([]);
      setSubAdminLoading(false);
      return;
    }

    setSubAdmins(data ?? []);
    setSubAdminError(null);
    setSubAdminLoading(false);
  }, []);

  const getAvatarInitials = (name?: string | null) =>
    name
      ? name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("")
      : "SA";

  const buildAvatarUrl = (path: string | null) =>
    path ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/admin-profile-images/${path}` : null;

  useEffect(() => {
    if (!isSuperAdmin) return;
    void loadSubAdmins();
  }, [isSuperAdmin, loadSubAdmins]);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const authPayload: { data: Record<string, string> } = {
      data: {
        full_name: fullName.trim(),
        name: fullName.trim(),
        username: username.trim(),
      },
    };
    const { error } = await supabase.auth.updateUser(authPayload);

    if (error) {
      toast.error(error.message);
    } else {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: email.trim() || user.email || null,
        username: username.trim(),
        full_name: fullName.trim(),
      });
      if (profileError) {
        toast.error(profileError.message);
        setSavingProfile(false);
        return;
      }
      toast.success("Profile updated.");
      await refreshProfile();
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

  const handleCreateSubAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuperAdmin) {
      toast.error("You do not have permission to create sub admins.");
      return;
    }
    if (!newSubAdmin.email.trim() || !newSubAdmin.password.trim() || !newSubAdmin.fullName.trim()) {
      toast.error("Enter a name, email, and temporary password.");
      return;
    }

    setCreatingSubAdmin(true);
    const { error } = await createSubAdmin({
      email: newSubAdmin.email.trim(),
      password: newSubAdmin.password.trim(),
      full_name: newSubAdmin.fullName.trim(),
      username: newSubAdmin.username.trim() || newSubAdmin.email.split("@")[0],
    });
    setCreatingSubAdmin(false);

    if (error) {
      toast.error(error || "Unable to create sub admin.");
      return;
    }

    toast.success("Sub Admin created.");
    setNewSubAdmin({ email: "", password: "", fullName: "", username: "" });
    await loadSubAdmins();
  };

  return (
    <Layout>
      <section className="container py-10 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Account Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your role, profile, and security settings.</p>
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
              <Button asChild className="w-full sm:w-auto">
                <Link to="/login">Go to login</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Information</CardTitle>
                <CardDescription>Current permissions and role.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                {role ? (
                  <Badge variant={isSuperAdmin ? "default" : "secondary"}>
                    {isSuperAdmin ? "Super Admin" : "Sub Admin"}
                  </Badge>
                ) : (
                  <Badge variant="outline">No role</Badge>
                )}
                <p className="text-sm text-muted-foreground">
                  {isSuperAdmin
                    ? "Full access to manage content and admins."
                    : isSubAdmin
                      ? "Limited access within assigned scope."
                      : "Contact a Super Admin for access."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Display Preferences</CardTitle>
                <CardDescription>Choose which category metadata is visible across the app.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="show-category-ids" className="text-sm font-medium text-foreground">
                      Show category IDs
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Display category short codes next to category names in the header, category pages, and search results.
                    </p>
                  </div>
                  <Switch
                    id="show-category-ids"
                    checked={showCategoryIds}
                    onCheckedChange={setShowCategoryIds}
                    aria-label="Show category IDs"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Image</CardTitle>
                <CardDescription>Upload and edit your profile image.</CardDescription>
              </CardHeader>
              <CardContent>
                {isAdmin ? (
                  <ProfileImageUploader
                    userId={user.id}
                    initialPath={profile?.profile_image_path ?? null}
                    onUploaded={() => refreshProfile()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Only admins can upload a profile image.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <form onSubmit={handleProfileSave}>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>
                    {isSuperAdmin
                      ? "Update your display name and username."
                      : "Sub Admins cannot edit name or username."}
                  </CardDescription>
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
                      disabled={!isSuperAdmin}
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
                      disabled={!isSuperAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Current email</Label>
                    <Input id="email" value={email} readOnly disabled type="email" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={savingProfile || !isSuperAdmin} className="w-full sm:w-auto">
                    {savingProfile ? "Saving..." : "Save profile"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <form onSubmit={handlePasswordSave}>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Update your account password.</CardDescription>
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
                  <Button type="submit" disabled={savingPassword} className="w-full sm:w-auto">
                    {savingPassword ? "Updating..." : "Update password"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {isSuperAdmin && (
              <Card>
                <form onSubmit={handleCreateSubAdmin}>
                  <CardHeader>
                    <CardTitle>Sub Admins</CardTitle>
                    <CardDescription>Invite and manage sub admins.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="sub-admin-name">Name</Label>
                        <Input
                          id="sub-admin-name"
                          value={newSubAdmin.fullName}
                          onChange={(event) => setNewSubAdmin((prev) => ({ ...prev, fullName: event.target.value }))}
                          placeholder="Alex Morgan"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sub-admin-username">Username</Label>
                        <Input
                          id="sub-admin-username"
                          value={newSubAdmin.username}
                          onChange={(event) => setNewSubAdmin((prev) => ({ ...prev, username: event.target.value }))}
                          placeholder="alex.morgan"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sub-admin-email">Email</Label>
                        <Input
                          id="sub-admin-email"
                          type="email"
                          value={newSubAdmin.email}
                          onChange={(event) => setNewSubAdmin((prev) => ({ ...prev, email: event.target.value }))}
                          placeholder="alex@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sub-admin-password">Temporary password</Label>
                        <Input
                          id="sub-admin-password"
                          type="password"
                          value={newSubAdmin.password}
                          onChange={(event) => setNewSubAdmin((prev) => ({ ...prev, password: event.target.value }))}
                          placeholder="Set a temporary password"
                        />
                      </div>
                    </div>
                    <div>
                      <Button type="submit" disabled={creatingSubAdmin} className="w-full sm:w-auto">
                        {creatingSubAdmin ? "Creating..." : "Create sub admin"}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Managed Sub Admins</h3>
                      {subAdminLoading && (
                        <p className="text-sm text-muted-foreground">Loading sub admins...</p>
                      )}
                      {subAdminError && (
                        <p className="text-sm text-destructive">{subAdminError}</p>
                      )}
                      {!subAdminLoading && !subAdminError && subAdmins.length === 0 && (
                        <p className="text-sm text-muted-foreground">No sub admins yet.</p>
                      )}
                      {!subAdminLoading && subAdmins.length > 0 && (
                        <div className="space-y-2">
                          {subAdmins.map((subAdmin) => (
                            <div
                              key={subAdmin.id}
                              className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 sm:flex-row sm:items-center sm:p-4"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage
                                    src={buildAvatarUrl(subAdmin.profile_image_path) ?? undefined}
                                    alt={subAdmin.full_name ?? subAdmin.username ?? "Sub Admin"}
                                  />
                                  <AvatarFallback className="text-xs">
                                    {getAvatarInitials(subAdmin.full_name || subAdmin.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {subAdmin.full_name || subAdmin.username || subAdmin.email}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {subAdmin.email || "No email"} ·{" "}
                                    {subAdmin.created_at
                                      ? format(new Date(subAdmin.created_at), "MMM dd, yyyy")
                                      : "Unknown date"}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary">Sub Admin</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </form>
              </Card>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Settings;
