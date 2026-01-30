import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
    return (
        <div className="w-full max-w-md px-4">
            <div className="flex justify-center mb-8">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-10 w-10 text-primary" />
                    <span className="text-2xl font-bold">Platform Console</span>
                </div>
            </div>

            <Card>
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl text-center">Sign in</CardTitle>
                    <CardDescription className="text-center">
                        Enter your credentials to access the admin console
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Placeholder form - actual auth will be implemented in Phase 2 */}
                    <form className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@example.com"
                                disabled
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                disabled
                            />
                        </div>
                        <Button className="w-full" disabled>
                            Sign in
                        </Button>
                    </form>

                    <div className="mt-6 p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground text-center">
                            <strong>Phase 1 Placeholder</strong>
                            <br />
                            Authentication will be implemented in Phase 2.
                            <br />
                            <Link href="/" className="text-primary underline underline-offset-4 mt-2 inline-block">
                                Go to Dashboard →
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
