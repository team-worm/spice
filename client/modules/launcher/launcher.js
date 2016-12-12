angular.module('Spice')
    .controller('LauncherCtrl', ['$scope', '$interval', function ($scope, $interval) {

        var self = this;

        self.nobinary = true;
        self.loadingBinary = false;

        $interval(function () {
            if (self.loadingBinary && $scope.mockloader.progress < 100) {

                $scope.mockloader.progress += 9;
            }
            if ($scope.mockloader.progress >= 100) {
                $scope.mockloader.progress = 0;
                self.loadingBinary = 0;
            }

        }, 100, 0, true);

        self.launchSelected = function () {
            self.loadingBinary = true;
            $scope.$emit('changeView', 'configuration');
        };

        /* Stream example code
         var stream = new DebuggerService.Stream();
         stream.write(1);
         var read1 = stream.read(function(data) { console.log('a got ' + data); });
         read1.done.then(function() { console.log('a done'); });
         stream.write(2);
         stream.read(function(data) { console.log('b got ' + data); })
         .done.then(function() { console.log('b done'); });

         stream.write(3);
         stream.cancelRead(read1.id);
         stream.write(4);

         stream.close();
         */
    }])
    .directive('spiceLauncher', function () {
        return {
            restrict: 'E',
            scope: {
                mockloader: '=mockloader'
            },
            templateUrl: 'modules/launcher/launcherTemplate.html'
        }
    });
