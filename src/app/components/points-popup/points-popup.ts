import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrophyDefinition } from '../../shared/models/gamification.model';

@Component({
    selector: 'app-points-popup',
    templateUrl: './points-popup.html',
    styleUrls: ['./points-popup.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PointsPopupComponent {
    readonly base = input.required<number>();
    readonly deadlineBoost = input(0);
    readonly streakBonus = input(0);
    readonly total = input.required<number>();
    readonly levelName = input.required<string>();
    readonly newTrophies = input<TrophyDefinition[]>([]);
    readonly streakCount = input(0);

    readonly dismiss = output<void>();

    onDismiss(): void {
        this.dismiss.emit();
    }
}
