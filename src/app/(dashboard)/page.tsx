import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome to Platform Console. Select a module from the sidebar to get started.
                </p>
            </div>

            {/* Quick stats cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
                        <Badge variant="secondary">Platform</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">
                            Content sources available
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Content Items</CardTitle>
                        <Badge variant="secondary">Platform</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">
                            Total content entries
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customers</CardTitle>
                        <Badge variant="info">CRM</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">
                            Active customers
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open Deals</CardTitle>
                        <Badge variant="info">CRM</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">
                            Deals in pipeline
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Getting started section */}
            <Card>
                <CardHeader>
                    <CardTitle>Getting Started</CardTitle>
                    <CardDescription>
                        Phase 1 complete. Navigate to platform or CRM modules to begin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border p-4">
                            <h3 className="font-semibold mb-2">Platform Module</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Manage content sources and entries from the CMS service.
                            </p>
                            <div className="flex gap-2">
                                <Badge>Sources</Badge>
                                <Badge>Content</Badge>
                            </div>
                        </div>
                        <div className="rounded-lg border p-4">
                            <h3 className="font-semibold mb-2">CRM Module</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Manage customers, deals, activities, and reports.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Badge>Customers</Badge>
                                <Badge>Deals</Badge>
                                <Badge>Activities</Badge>
                                <Badge>Reports</Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
